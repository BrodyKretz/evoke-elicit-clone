"use client";

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { Check, Sparkles } from "@/components/ui/Icon";

// Chat-style narrative timeline for a pipeline run. Two modes:
//   - In-flight (generate not yet done): subscribes to the SSE event stream
//     and appends a new entry for each stage transition / criterion /
//     column-generation / progress tick / tldr / complete event.
//   - Completed: renders a past-tense static narrative reconstructed from
//     the persisted report state (no SSE — that history is gone).
//
// Used as the left rail of ExtractionView and reusable anywhere a run's
// process is worth showing.

// Mirror of lib/events.ts kept here so this stays a client component without
// pulling node:events.
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

type Entry = {
  /** Stable key for React. */
  id: string;
  /** Headline shown bold. */
  title: string;
  /** Optional sub-line beneath the title. */
  detail?: string;
  /** Visual style. */
  kind: "step" | "criterion" | "columns" | "progress" | "tldr" | "done" | "error";
};

function formatStage(stage: PipelineStage): string {
  return stage === "synthesize" ? "synthesis" : stage;
}

function eventToEntry(e: PipelineEvent): Entry | null {
  switch (e.type) {
    case "stage.start":
      return {
        id: `s-${e.stage}-${e.ts}`,
        title: `Started ${formatStage(e.stage)}`,
        kind: "step",
      };
    case "stage.done": {
      const data = e.data ?? {};
      const detail = (() => {
        if (e.stage === "gather") {
          const n = data.sourcesFound;
          return typeof n === "number" ? `${n} sources from the corpus` : undefined;
        }
        if (e.stage === "screen") {
          const inc = data.sourcesIncluded;
          const total = data.total;
          if (typeof inc === "number" && typeof total === "number") {
            return `${inc} included of ${total} screened`;
          }
          return undefined;
        }
        if (e.stage === "extract") {
          const pts = data.dataPointsExtracted;
          const rows = data.rows;
          if (typeof pts === "number" && typeof rows === "number") {
            return `${pts} data points across ${rows} papers`;
          }
          return undefined;
        }
        if (e.stage === "synthesize") {
          const blocks = data.blocks;
          return typeof blocks === "number" ? `${blocks} report blocks drafted` : undefined;
        }
        return undefined;
      })();
      return {
        id: `d-${e.stage}-${e.ts}`,
        title: `Finished ${formatStage(e.stage)}`,
        detail,
        kind: "step",
      };
    }
    case "criterion":
      return {
        id: `c-${e.ts}`,
        title: "Drafted inclusion criterion",
        detail: e.text,
        kind: "criterion",
      };
    case "columns":
      return {
        id: `col-${e.ts}`,
        title: "Generated extraction columns",
        detail: e.columns.join(" · "),
        kind: "columns",
      };
    case "progress":
      // Don't push these — we collapse them into a single "screened N / M"
      // line below (one entry, mutated as events stream in).
      return null;
    case "tldr":
      return {
        id: `tldr-${e.ts}`,
        title: "Wrote the TLDR",
        detail: e.text,
        kind: "tldr",
      };
    case "complete":
      return { id: `complete-${e.ts}`, title: "Run complete", kind: "done" };
    case "stage.error":
    case "error":
      return {
        id: `err-${e.ts}`,
        title: "Pipeline error",
        detail: "error" in e ? e.error : undefined,
        kind: "error",
      };
  }
}

// Past-tense narrative for a finished run, reconstructed from report state.
function staticTimeline(report: Report): Entry[] {
  const out: Entry[] = [];
  const s = report.status;
  if (s.gather.done) {
    out.push({
      id: "h-gather",
      title: "Gathered sources",
      detail:
        s.gather.sourcesFound != null
          ? `${s.gather.sourcesFound} sources from ${report.corpus === "core" ? "CORE" : "Semantic Scholar"}`
          : undefined,
      kind: "step",
    });
  }
  if (report.correctedQuery && report.correctedQuery !== report.question) {
    out.push({
      id: "h-corrected",
      title: "Auto-corrected the query",
      detail: `Searched as: ${report.correctedQuery}`,
      kind: "criterion",
    });
  }
  const criterion = report.screening?.criteria[0]?.text;
  if (criterion) {
    out.push({
      id: "h-criterion",
      title: "Drafted inclusion criterion",
      detail: criterion,
      kind: "criterion",
    });
  }
  if (s.screen.done && s.screen.sourcesIncluded != null) {
    out.push({
      id: "h-screen",
      title: "Screened sources",
      detail: `${s.screen.sourcesIncluded} passed of ${report.screening?.results.length ?? "?"} reviewed`,
      kind: "step",
    });
  }
  const cols = report.extraction?.columns;
  if (cols && cols.length > 0) {
    out.push({
      id: "h-cols",
      title: "Generated extraction columns",
      detail: cols.join(" · "),
      kind: "columns",
    });
  }
  if (s.extract.done && s.extract.dataPointsExtracted != null) {
    out.push({
      id: "h-extract",
      title: "Extracted data",
      detail: `${s.extract.dataPointsExtracted} data points across ${report.extraction?.rows.length ?? 0} papers`,
      kind: "step",
    });
  }
  if (s.generate.done) {
    out.push({
      id: "h-synth",
      title: "Synthesized report",
      detail: report.tldr ? report.tldr.slice(0, 160) + (report.tldr.length > 160 ? "…" : "") : undefined,
      kind: "tldr",
    });
    out.push({ id: "h-complete", title: "Run complete", kind: "done" });
  }
  return out;
}

const DOT_BY_KIND: Record<Entry["kind"], string> = {
  step: "bg-teal",
  criterion: "bg-teal",
  columns: "bg-teal",
  progress: "bg-text-faint",
  tldr: "bg-teal",
  done: "bg-teal",
  error: "bg-error",
};

export function LiveProgressFeed({ report }: { report: Report }) {
  const done = report.status.generate.done;
  const [entries, setEntries] = useState<Entry[]>(() => (done ? staticTimeline(report) : []));
  const [streaming, setStreaming] = useState(false);
  // Sticky progress line that mutates as `progress` events arrive (rather
  // than pushing a new entry per tick).
  const [screenProgress, setScreenProgress] = useState<{ done: number; total: number } | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const es = new EventSource(`/api/reports/${report.id}/stream`);
    setStreaming(true);
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as PipelineEvent;
        if (ev.type === "progress") {
          if (ev.stage === "screen") setScreenProgress({ done: ev.done, total: ev.total });
          if (ev.stage === "extract") setExtractProgress({ done: ev.done, total: ev.total });
        } else {
          const entry = eventToEntry(ev);
          if (entry) setEntries((prev) => [...prev, entry]);
        }
        if (ev.type === "complete" || ev.type === "error") {
          setStreaming(false);
          es.close();
        }
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      setStreaming(false);
      es.close();
    };
    return () => es.close();
  }, [report.id, done]);

  // Auto-scroll to the bottom whenever new content arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, screenProgress, extractProgress, streaming]);

  return (
    <div className="rounded-[12px] border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          {done ? "Run timeline" : "Live progress"}
        </div>
        {streaming && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-bright">
            <span className="grid h-2 w-2 place-items-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-teal/60" />
              <span className="absolute h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
            streaming
          </span>
        )}
      </div>

      <div ref={scrollRef} className="scroll-pane max-h-[420px] overflow-y-auto pr-1">
        {entries.length === 0 && !streaming && (
          <div className="rounded-md bg-surface-muted px-3 py-3 text-[12.5px] text-text-muted">
            No timeline available yet.
          </div>
        )}
        {entries.length === 0 && streaming && (
          <div className="rounded-md bg-surface-muted px-3 py-3 text-[12.5px] text-text-muted">
            <Sparkles size={11} className="-mt-0.5 mr-1 inline text-teal-bright" />
            Spinning up the pipeline…
          </div>
        )}

        <ol className="relative space-y-2.5">
          {/* connector line */}
          {entries.length > 1 && (
            <span
              aria-hidden
              className="absolute left-[5px] top-2 -ml-px h-[calc(100%-1rem)] w-px bg-border"
            />
          )}
          {entries.map((e) => (
            <li key={e.id} className="relative flex items-start gap-2.5 pl-0">
              <span
                className={
                  "relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-surface " +
                  DOT_BY_KIND[e.kind]
                }
              />
              <div className="min-w-0">
                <div
                  className={
                    "text-[12.5px] font-medium leading-snug " +
                    (e.kind === "error" ? "text-error" : "text-text")
                  }
                >
                  {e.kind === "done" && <Check size={11} className="-mt-0.5 mr-1 inline text-teal-bright" />}
                  {e.title}
                </div>
                {e.detail && (
                  <div className="mt-0.5 break-words text-[12px] leading-snug text-text-muted">
                    {e.detail}
                  </div>
                )}
              </div>
            </li>
          ))}

          {/* sticky live progress for screen/extract — only while streaming */}
          {streaming && screenProgress && (
            <li className="relative flex items-start gap-2.5">
              <span className="relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-text-faint ring-2 ring-surface" />
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium leading-snug text-text">
                  Screening papers
                </div>
                <div className="mt-0.5 text-[12px] text-text-muted">
                  {screenProgress.done} of {screenProgress.total}
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-1 bg-teal transition-all"
                    style={{ width: `${(screenProgress.done / Math.max(screenProgress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          )}
          {streaming && extractProgress && (
            <li className="relative flex items-start gap-2.5">
              <span className="relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-text-faint ring-2 ring-surface" />
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium leading-snug text-text">
                  Extracting fields
                </div>
                <div className="mt-0.5 text-[12px] text-text-muted">
                  {extractProgress.done} of {extractProgress.total} papers
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-1 bg-teal transition-all"
                    style={{ width: `${(extractProgress.done / Math.max(extractProgress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
