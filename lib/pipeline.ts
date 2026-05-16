// Background pipeline runner. Two entry points:
//   - `runPipeline` — full gather → screen → extract → synthesize (POST /api/reports)
//   - `runFromScreening` — screen → extract → synthesize against an existing
//     gathered paper list (POST /api/reports/[id]/rescreen). Emits a synthetic
//     gather.done event so the live-progress UI shows gather as already done.
//
// Both emit stage events to the run's bus (consumed by the SSE handler) and
// persist the final report to the store.

import { saveRun } from "@/lib/store";
import { searchPapers, type CorpusProvider } from "@/lib/corpus";
import { generateCriterion, screenPapers } from "@/lib/agents/screen";
import { extractPapers } from "@/lib/agents/extract";
import { synthesizeReport, type SynthesisAction } from "@/lib/agents/synthesize";
import { suggestCorrectedQuery } from "@/lib/agents/normalize";
import { expandQuery } from "@/lib/agents/expand-query";
import { emit, makeEmitter } from "@/lib/events";
import type { Paper, Report, ScreeningCriterion } from "@/lib/types";

function corpusLabel(corpus: CorpusProvider): string {
  return corpus === "core" ? "CORE" : "Semantic Scholar";
}

// Finalize a run that ended early because there's nothing left to process
// (zero gathered papers, or zero papers with abstracts). Distinct from
// persistAndFinalize, which is for stage-level errors.
function finalizeEmpty(runId: string, report: Report, tldr: string) {
  saveRun({ ...report, tldr });
  emit(runId, { type: "complete" });
}

async function doSearch(
  corpus: CorpusProvider,
  query: string,
  onEvent: ReturnType<typeof makeEmitter>,
  limit = 25
): Promise<{ papers: Paper[]; error?: string }> {
  try {
    const papers = await searchPapers(corpus, query, limit);
    return { papers };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "search failed";
    onEvent({ type: "stage.error", stage: "gather", error: msg });
    return { papers: [], error: msg };
  }
}

// Run the original query and any expansion variants in parallel and merge the
// results (dedupe by paper id, preserve the original's rank for ties). Each
// query gets a smaller per-call limit so the total isn't blown up.
async function gatherWithExpansion(
  corpus: CorpusProvider,
  query: string,
  onEvent: ReturnType<typeof makeEmitter>
): Promise<{ papers: Paper[]; error?: string; variants: string[] }> {
  const { variants } = await expandQuery(query).catch(() => ({
    variants: [] as string[],
  }));
  const queries = [query, ...variants];
  const perQueryLimit = variants.length > 0 ? 15 : 25;

  // Single-query path stays identical to before — no extra latency.
  if (variants.length === 0) {
    const res = await doSearch(corpus, query, onEvent, perQueryLimit);
    return { ...res, variants: [] };
  }

  const results = await Promise.all(
    queries.map((q) => doSearch(corpus, q, onEvent, perQueryLimit))
  );

  // If every single query errored, surface the first error.
  const allFailed = results.every((r) => r.error);
  if (allFailed) {
    return { papers: [], error: results[0]?.error ?? "search failed", variants };
  }

  const seen = new Set<string>();
  const merged: Paper[] = [];
  for (const r of results) {
    for (const p of r.papers) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
  }
  // Cap at 25 to keep downstream cost bounded.
  return { papers: merged.slice(0, 25), variants };
}

export async function runPipeline(
  runId: string,
  question: string,
  initial: Report,
  action: SynthesisAction = "report"
) {
  const onEvent = makeEmitter(runId);
  let report = initial;
  const corpus: CorpusProvider = report.corpus ?? "s2";

  // ---- Stage 1: Gather --------------------------------------------------
  onEvent({ type: "stage.start", stage: "gather" });
  // Parallel-search expansion: ask Haiku for 1-3 alternative phrasings and run
  // them concurrently with the original. Merges results dedupe-by-id so the
  // screener sees a wider, less single-phrasing-biased corpus.
  let { papers, error: gatherError, variants } = await gatherWithExpansion(corpus, question, onEvent);
  if (gatherError) {
    emit(runId, { type: "error", error: `gather: ${gatherError}` });
    persistAndFinalize(report, { gatherError });
    return;
  }

  // Zero hits on the user's literal query (and the variants didn't save us):
  // try one silent typo-correction pass via Haiku, then retry gather. Only
  // retries once — if the corrected version is also empty we fall through to
  // the empty-finalize path.
  let effectiveQuery = question;
  if (papers.length === 0) {
    const corrected = await suggestCorrectedQuery(question).catch(() => null);
    if (corrected && corrected !== question) {
      const retry = await doSearch(corpus, corrected, onEvent);
      if (retry.error) {
        emit(runId, { type: "error", error: `gather: ${retry.error}` });
        persistAndFinalize(report, { gatherError: retry.error });
        return;
      }
      papers = retry.papers;
      if (papers.length > 0) {
        effectiveQuery = corrected;
        report = { ...report, correctedQuery: corrected };
      }
    }
  }

  onEvent({ type: "stage.done", stage: "gather", data: { sourcesFound: papers.length } });
  report = {
    ...report,
    searchResults: papers,
    gatheredSources: papers,
    status: { ...report.status, gather: { done: true, sourcesFound: papers.length } },
  };

  // Soft-empty case: gather succeeded (possibly after a correction retry) but
  // still returned zero papers. Don't crash downstream stages — finalize
  // with a friendly tldr that names the corpus and suggests recovery.
  if (papers.length === 0) {
    const alt = corpus === "s2" ? "switching to the CORE corpus" : "switching to Semantic Scholar";
    const tldr = `No sources found in ${corpusLabel(corpus)} for this query. Try rewording the question${corpus === "s2" ? " (note: without a SEMANTIC_SCHOLAR_API_KEY, unauthenticated S2 ranks weakly)" : ""}, or ${alt}.`;
    finalizeEmpty(runId, report, tldr);
    return;
  }

  await runScreenExtractSynth(runId, effectiveQuery, report, papers, null, action);
}

// Re-run from the screening stage onwards. Used by rescreen — the user has
// edited the criterion and wants to cascade the change downstream without
// touching the gathered paper list.
export async function runFromScreening(
  runId: string,
  question: string,
  report: Report,
  papers: Paper[],
  criterionOverride: ScreeningCriterion
) {
  const onEvent = makeEmitter(runId);
  // Emit a synthetic gather.done so the UI shows gather as a finished step.
  onEvent({
    type: "stage.done",
    stage: "gather",
    data: { sourcesFound: papers.length },
  });
  await runScreenExtractSynth(runId, question, report, papers, criterionOverride);
}

// Shared screen → extract → synthesize body. Either entry point lands here.
async function runScreenExtractSynth(
  runId: string,
  question: string,
  reportIn: Report,
  papers: Paper[],
  criterionOverride: ScreeningCriterion | null,
  action: SynthesisAction = "report"
) {
  const onEvent = makeEmitter(runId);
  let report = reportIn;
  const screenable = papers.filter((p) => p.abstract);

  // Soft-empty case: gather found papers, but none had abstracts (S2/CORE
  // sometimes returns metadata-only records). Screening can't work without
  // text, so finalize gracefully instead of crashing.
  if (screenable.length === 0) {
    const tldr = `Found ${papers.length} source${
      papers.length === 1 ? "" : "s"
    } but none had abstracts available for screening. Abstracts are required for the screening + extraction stages.`;
    finalizeEmpty(runId, report, tldr);
    return;
  }

  // ---- Stage 2: Screen --------------------------------------------------
  onEvent({ type: "stage.start", stage: "screen" });
  let criterion: ScreeningCriterion | null = null;
  let screeningResults: Awaited<ReturnType<typeof screenPapers>> = [];
  try {
    criterion = criterionOverride ?? (await generateCriterion(question));
    onEvent({ type: "criterion", text: criterion.text });
    screeningResults = await screenPapers(screenable, criterion, question, 3, onEvent);
    const includedCount = screeningResults.filter((r) => r.decision === "include").length;
    onEvent({
      type: "stage.done",
      stage: "screen",
      data: { sourcesIncluded: includedCount, total: screeningResults.length },
    });
    report = {
      ...report,
      screening: { criteria: [criterion], results: screeningResults },
      status: {
        ...report.status,
        screen: { done: true, sourcesIncluded: includedCount },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "screening failed";
    onEvent({ type: "stage.error", stage: "screen", error: msg });
    emit(runId, { type: "error", error: `screen: ${msg}` });
    persistAndFinalize(report, { screenError: msg });
    return;
  }

  // ---- Stage 3: Extract -------------------------------------------------
  const screenInIds = new Set(
    screeningResults
      .filter((r) => r.decision === "include" || r.decision === "maybe")
      .map((r) => r.paperId)
  );
  const toExtract = screenable.filter((p) => screenInIds.has(p.id));

  // Soft-empty case: screening excluded every paper. Don't crash extract —
  // finalize with a friendly tldr that surfaces the criterion so the user
  // understands why and can edit it via the rescreen flow.
  if (toExtract.length === 0) {
    const criterionText = criterion?.text ?? "(no criterion generated)";
    const tldr = `Screening excluded all ${screenable.length} gathered source${
      screenable.length === 1 ? "" : "s"
    }. The auto-generated criterion may have been too strict — try widening it or rephrasing the question.\n\nCriterion used: ${criterionText}`;
    finalizeEmpty(runId, report, tldr);
    return;
  }

  onEvent({ type: "stage.start", stage: "extract" });
  let extraction: Report["extraction"] | undefined;
  try {
    extraction = await extractPapers(toExtract, question, 3, onEvent);
    const dataPoints = extraction.rows.length * extraction.columns.length;
    onEvent({
      type: "stage.done",
      stage: "extract",
      data: { dataPointsExtracted: dataPoints, rows: extraction.rows.length },
    });
    report = {
      ...report,
      extraction,
      references: extraction.rows.map((r) => r.paper),
      status: {
        ...report.status,
        extract: { done: true, dataPointsExtracted: dataPoints },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "extraction failed";
    onEvent({ type: "stage.error", stage: "extract", error: msg });
    emit(runId, { type: "error", error: `extract: ${msg}` });
    persistAndFinalize(report, { extractError: msg });
    return;
  }

  // ---- Stage 4: Synthesize ----------------------------------------------
  onEvent({ type: "stage.start", stage: "synthesize" });
  try {
    const out = await synthesizeReport(question, extraction!, criterion?.text ?? null, action);
    onEvent({ type: "tldr", text: out.tldr });
    onEvent({ type: "stage.done", stage: "synthesize", data: { blocks: out.blocks.length } });
    report = {
      ...report,
      tldr: out.tldr,
      report: out.blocks,
      initialView: "report",
      status: { ...report.status, generate: { done: true } },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "synthesis failed";
    onEvent({ type: "stage.error", stage: "synthesize", error: msg });
    emit(runId, { type: "error", error: `synthesize: ${msg}` });
    persistAndFinalize(report, { synthError: msg });
    return;
  }

  saveRun(report);
  onEvent({ type: "complete" });
}

function persistAndFinalize(
  report: Report,
  errors: { gatherError?: string; screenError?: string; extractError?: string; synthError?: string }
) {
  const parts: string[] = [];
  if (errors.gatherError) parts.push(`Search failed: ${errors.gatherError}.`);
  else parts.push(`Gathered ${report.status.gather.sourcesFound ?? 0} sources.`);
  if (errors.screenError) parts.push(`Screening failed: ${errors.screenError}.`);
  if (errors.extractError) parts.push(`Extraction failed: ${errors.extractError}.`);
  if (errors.synthError) parts.push(`Synthesis failed: ${errors.synthError}.`);
  saveRun({ ...report, tldr: parts.join(" ") });
}
