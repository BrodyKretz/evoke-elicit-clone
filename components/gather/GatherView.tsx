"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Report } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { ArrowRight, Book, Check, User } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";

// Mirror lib/events.ts. Kept duplicated so this component doesn't pull in
// server-only modules (node:events) on the client bundle.
type PipelineStage = "gather" | "screen" | "extract" | "synthesize";
type PipelineEvent =
  | { type: "stage.start"; stage: PipelineStage; ts: number }
  | { type: "stage.done"; stage: PipelineStage; data?: Record<string, unknown>; ts: number }
  | { type: "stage.error"; stage: PipelineStage; error: string; ts: number }
  | { type: "criterion"; text: string; ts: number }
  | { type: "columns"; columns: string[]; ts: number }
  | { type: "progress"; stage: "screen" | "extract"; done: number; total: number; ts: number }
  | { type: "tldr"; text: string; ts: number }
  | { type: "complete"; ts: number }
  | { type: "error"; error: string; ts: number };

const STAGE_LABEL: Record<PipelineStage, string> = {
  gather: "Gathering sources",
  screen: "Screening for inclusion",
  extract: "Extracting structured data",
  synthesize: "Synthesizing report",
};

type StageState = "pending" | "running" | "done" | "error";

function deriveStageStates(events: PipelineEvent[]): Record<PipelineStage, StageState> {
  const state: Record<PipelineStage, StageState> = {
    gather: "pending",
    screen: "pending",
    extract: "pending",
    synthesize: "pending",
  };
  for (const e of events) {
    if (e.type === "stage.start") state[e.stage] = "running";
    else if (e.type === "stage.done") state[e.stage] = "done";
    else if (e.type === "stage.error") state[e.stage] = "error";
  }
  return state;
}

function StageRow({
  stage,
  state,
  meta,
}: {
  stage: PipelineStage;
  state: StageState;
  meta?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-[1.5px]",
          state === "done" && "border-teal bg-teal text-white",
          state === "running" && "border-teal text-teal-bright animate-pulse",
          state === "pending" && "border-text-faint text-text-faint",
          state === "error" && "border-error text-error"
        )}
      >
        {state === "done" ? (
          <Check size={11} />
        ) : state === "running" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium",
            state === "pending" && "text-text-muted",
            state === "running" && "text-text",
            state === "done" && "text-text-muted line-through decoration-text-faint",
            state === "error" && "text-error"
          )}
        >
          {STAGE_LABEL[stage]}
        </div>
        {meta && <div className="mt-0.5 text-xs text-text-muted">{meta}</div>}
      </div>
    </li>
  );
}

export function GatherView({ report }: { report: Report }) {
  const { show } = useToast();
  const router = useRouter();
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [streamed, setStreamed] = useState(false);

  // Subscribe to SSE only when the run is still in flight. Fixture reports
  // (with everything already done) skip the stream.
  useEffect(() => {
    if (report.status.generate.done) return;
    // Track whether synthesis actually completed within this stream — used to
    // decide whether to navigate to /report on `complete`. Early-finalized
    // runs (zero sources / no abstracts) emit `complete` without ever
    // reaching synthesize, and should stay on /gather so the empty state
    // is visible.
    let synthCompleted = false;
    const es = new EventSource(`/api/reports/${report.id}/stream`);
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as PipelineEvent;
        if (ev.type === "stage.done" && ev.stage === "synthesize") {
          synthCompleted = true;
        }
        setEvents((prev) => [...prev, ev]);
        setStreamed(true);
        if (ev.type === "complete") {
          es.close();
          if (synthCompleted) {
            // Pause briefly so the user sees the final "done" tick, then go.
            setTimeout(() => router.replace(`/report/${report.id}/report`), 800);
          } else {
            // Empty-finalize: stay on /gather, re-fetch server data so the
            // updated tldr / status renders.
            router.refresh();
          }
        } else if (ev.type === "error") {
          es.close();
        }
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [report.id, report.status.generate.done, router]);

  const stageStates = deriveStageStates(events);

  const liveCriterion = events.find((e): e is Extract<PipelineEvent, { type: "criterion" }> => e.type === "criterion")?.text;
  const liveColumns = events
    .filter((e): e is Extract<PipelineEvent, { type: "columns" }> => e.type === "columns")
    .at(-1)?.columns;
  const liveTldr = events.find((e): e is Extract<PipelineEvent, { type: "tldr" }> => e.type === "tldr")?.text;
  const fatalError = events.find((e): e is Extract<PipelineEvent, { type: "error" }> => e.type === "error")?.error;

  // Per-stage metadata
  const gatherDoneEvent = events.find((e) => e.type === "stage.done" && e.stage === "gather") as
    | Extract<PipelineEvent, { type: "stage.done" }>
    | undefined;
  const screenDoneEvent = events.find((e) => e.type === "stage.done" && e.stage === "screen") as
    | Extract<PipelineEvent, { type: "stage.done" }>
    | undefined;
  const extractDoneEvent = events.find((e) => e.type === "stage.done" && e.stage === "extract") as
    | Extract<PipelineEvent, { type: "stage.done" }>
    | undefined;
  type ProgressEvent = Extract<PipelineEvent, { type: "progress" }>;
  const progressEvents = events.filter((e): e is ProgressEvent => e.type === "progress");
  const lastScreenProgress = [...progressEvents].reverse().find((e) => e.stage === "screen");
  const lastExtractProgress = [...progressEvents].reverse().find((e) => e.stage === "extract");

  const providerLabel = report.corpus === "core" ? "CORE" : "Semantic Scholar";
  const stageMeta: Record<PipelineStage, string | undefined> = {
    gather: gatherDoneEvent
      ? `${(gatherDoneEvent.data?.sourcesFound as number) ?? 0} sources from ${providerLabel}`
      : stageStates.gather === "running"
      ? `Hitting ${providerLabel}…`
      : undefined,
    screen: screenDoneEvent
      ? `${(screenDoneEvent.data?.sourcesIncluded as number) ?? 0} included of ${(screenDoneEvent.data?.total as number) ?? 0}`
      : lastScreenProgress
      ? `${lastScreenProgress.done} of ${lastScreenProgress.total} screened`
      : stageStates.screen === "running"
      ? "Generating criterion…"
      : undefined,
    extract: extractDoneEvent
      ? `${(extractDoneEvent.data?.dataPointsExtracted as number) ?? 0} data points across ${(extractDoneEvent.data?.rows as number) ?? 0} papers`
      : lastExtractProgress
      ? `${lastExtractProgress.done} of ${lastExtractProgress.total} papers extracted`
      : stageStates.extract === "running"
      ? "Generating columns…"
      : undefined,
    synthesize: stageStates.synthesize === "done"
      ? "Report drafted"
      : stageStates.synthesize === "running"
      ? "Drafting report (Opus)…"
      : undefined,
  };

  const sources = report.gatheredSources ?? [];
  const showStaticPapers = !streamed && sources.length > 0;

  // True after the pipeline finalized early — covers all the soft-empty
  // paths: zero sources gathered, none had abstracts, or all were excluded
  // by screening. Detected from the SSE stream (saw `complete` but never
  // `stage.done:synthesize`) with a fallback to persisted status for
  // reloaded pages whose SSE history has expired.
  const seenComplete = events.some((e) => e.type === "complete");
  const seenSynthDone = events.some(
    (e) => e.type === "stage.done" && e.stage === "synthesize"
  );
  const finalizedEmpty =
    (seenComplete && !seenSynthDone) ||
    (events.length === 0 &&
      report.status.gather.done &&
      !report.status.generate.done &&
      !report.report &&
      !fatalError);

  const inProgress = !report.status.generate.done && !fatalError && !finalizedEmpty;

  // Choose a heading for the empty-state banner based on which soft-empty
  // path we ended up in.
  const emptyHeading =
    sources.length === 0
      ? "No sources found."
      : report.screening &&
        report.screening.results.length > 0 &&
        report.screening.results.every((r) => r.decision === "exclude")
      ? "All sources excluded by screening."
      : "Pipeline ended early.";

  return (
    <div>
      {(inProgress || finalizedEmpty) && (
        <h2 className="mb-3.5 font-display text-[26px] font-medium leading-snug text-teal-bright">
          {report.question}
        </h2>
      )}
      {report.correctedQuery && report.correctedQuery !== report.question && (
        <div className="mb-1.5 text-[13px] text-text-muted">
          Searched as: <span className="font-medium text-text">{report.correctedQuery}</span>{" "}
          <span className="text-text-faint">(auto-corrected from a possible typo)</span>
        </div>
      )}
      {inProgress && (
        <div className="mb-1.5 text-sm text-text-muted">
          Evoke is building and refining understanding of the research. Report will become available once all steps are complete.
        </div>
      )}

      {fatalError && (
        <div className="mb-6 rounded-[10px] border border-error/30 bg-error-bg px-4 py-3 text-sm text-error">
          Pipeline failed: {fatalError}
        </div>
      )}

      {finalizedEmpty && (
        <div className="mb-6 rounded-[10px] border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <div className="font-semibold">{emptyHeading}</div>
          <div className="mt-1 whitespace-pre-line">{report.tldr}</div>
        </div>
      )}

      {/* Live pipeline progress card — only when streaming */}
      {streamed && (
        <section className="mt-6 mb-8 rounded-[10px] border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-teal-bright">
            Live progress
          </div>
          <ol className="divide-y divide-border">
            {(["gather", "screen", "extract", "synthesize"] as const).map((s) => (
              <StageRow key={s} stage={s} state={stageStates[s]} meta={stageMeta[s]} />
            ))}
          </ol>

          {liveCriterion && (
            <div className="mt-4 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs">
              <span className="font-semibold text-teal-bright">Criterion:</span>{" "}
              <span className="text-text">{liveCriterion}</span>
            </div>
          )}
          {liveColumns && liveColumns.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs">
              <span className="font-semibold text-teal-bright">Extraction columns:</span>{" "}
              <span className="text-text">{liveColumns.join(" · ")}</span>
            </div>
          )}
          {liveTldr && (
            <div className="mt-2 rounded-md border border-border bg-teal-light px-3 py-2 text-xs">
              <span className="font-semibold text-teal-bright">TLDR:</span>{" "}
              <span className="text-text">{liveTldr}</span>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <header className="mb-6 flex items-center justify-between border-b border-t border-border py-4">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full border-[1.5px] border-teal text-teal-bright">
              <Check size={12} />
            </span>
            Gather sources
          </div>
          <button className="btn" onClick={() => show("Next step")}>
            View next <ArrowRight size={13} />
          </button>
        </header>

        <div className="mb-1 text-[13px] text-text-muted">
          Relevant sources identified <strong className="ml-1.5 font-semibold text-text">{report.status.gather.sourcesFound ?? sources.length}</strong>
        </div>
        <div className="mb-5 text-[13px] text-text-muted">
          Based on your research question, below are some of the top sources we&apos;ve found
        </div>

        {showStaticPapers ? (
          sources.map((p) => (
            <article key={p.id} className="mb-3.5 rounded-[10px] border border-border bg-surface p-5">
              <h4 className="mb-2 text-[15px] font-semibold">{p.title}</h4>
              <div className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] text-text-muted">
                <User size={13} /> {p.authors.slice(0, 4).join(", ")}
                {p.authors.length > 4 ? ` +${p.authors.length - 4}` : ""}
              </div>
              <div className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-text-muted">
                <Book size={13} />
                {p.journal ? p.journal + " · " : ""}
                {p.year}
                {p.citations != null ? ` · ${p.citations} citations` : ""}
              </div>
              {p.abstract && <p className="text-sm leading-relaxed text-text">{p.abstract}</p>}
            </article>
          ))
        ) : streamed && sources.length === 0 && !finalizedEmpty ? (
          <div className="rounded-[10px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
            Papers will appear here as the pipeline progresses.
          </div>
        ) : null}
      </section>
    </div>
  );
}
