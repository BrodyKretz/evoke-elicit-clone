import { NextResponse } from "next/server";
import { isCorpusProvider, searchPapers } from "@/lib/corpus";
import { generateCriterion, screenPapers } from "@/lib/agents/screen";
import { suggestCorrectedQuery } from "@/lib/agents/normalize";
import type { ScreeningCriterion } from "@/lib/types";

// Lab > Systematic Review. One-shot pipeline: search → screen against a
// user-supplied (or auto-generated) inclusion criterion → return papers
// alongside their screening decisions. Smaller default limit than Find Papers
// because every paper triggers an LLM call.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { query?: string; criterion?: string; corpus?: string; limit?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const corpusParam = body.corpus ?? "s2";
  if (!isCorpusProvider(corpusParam)) {
    return NextResponse.json({ error: "corpus must be 's2' or 'core'" }, { status: 400 });
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 12), 1), 25);

  try {
    const corrected = await suggestCorrectedQuery(query).catch(() => null);
    const effectiveQuery = corrected && corrected !== query ? corrected : query;

    const papers = await searchPapers(corpusParam, effectiveQuery, limit);
    if (papers.length === 0) {
      return NextResponse.json({
        papers: [],
        screening: [],
        criterion: null,
        correctedQuery: corrected && corrected !== query ? corrected : undefined,
      });
    }

    const userCriterionText = (body.criterion ?? "").trim();
    let criterion: ScreeningCriterion;
    if (userCriterionText) {
      criterion = { id: "c1", text: userCriterionText };
    } else {
      criterion = await generateCriterion(query);
    }

    const screening = await screenPapers(papers, criterion, query, 3);

    return NextResponse.json({
      papers,
      screening,
      criterion,
      correctedQuery: corrected && corrected !== query ? corrected : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "review failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
