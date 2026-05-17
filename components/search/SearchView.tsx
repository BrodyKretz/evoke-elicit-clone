"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Paper, Report, ScreeningDecision, ScreeningResult } from "@/lib/types";
import { Cite } from "@/components/ui/Cite";
import { useToast } from "@/components/ui/Toast";
import { Book, Check, Download, FileText, Link, MessageSquare, Search, Sort, Sparkles, X } from "@/components/ui/Icon";
import { addToLibrary, getLibrary, subscribeLibrary } from "@/lib/library";
import { cn } from "@/lib/utils/cn";

const DECISION_STYLE: Record<ScreeningDecision, { label: string; cls: string; rationaleCls: string; why: string }> = {
  include: {
    label: "Included",
    cls: "bg-teal-light text-teal-bright",
    rationaleCls: "border-teal/30 bg-teal-light/40 text-teal-bright",
    why: "Why included",
  },
  maybe: {
    label: "Maybe",
    cls: "bg-chip-bg text-text-muted",
    rationaleCls: "border-amber-200 bg-amber-50 text-amber-900",
    why: "Why maybe",
  },
  exclude: {
    label: "Excluded",
    cls: "bg-chip-bg text-text-faint line-through",
    rationaleCls: "border-border bg-surface-muted text-text-muted",
    why: "Why excluded",
  },
};

function ScreeningBadge({ result }: { result: ScreeningResult }) {
  const { label, cls } = DECISION_STYLE[result.decision];
  return (
    <span
      title={result.rationale}
      className={cn(
        "inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        cls
      )}
    >
      {result.decision === "include" && <Check size={10} />}
      {label}
    </span>
  );
}

function Result({
  paper,
  idx,
  screening,
  sourceLabel,
  saved,
  onSave,
}: {
  paper: Paper;
  idx: number;
  screening?: ScreeningResult;
  sourceLabel: string;
  saved: boolean;
  onSave: () => void;
}) {
  const dimmed = screening?.decision === "exclude";
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-muted md:grid-cols-2",
        dimmed && "opacity-60"
      )}
    >
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {screening && <ScreeningBadge result={screening} />}
          </div>
          {saved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal-bright">
              <Check size={10} /> Saved
            </span>
          ) : (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text-muted hover:border-teal hover:text-teal-bright"
              title={`Save to library (${sourceLabel})`}
            >
              <Book size={10} /> Save
            </button>
          )}
        </div>
        <div className="mb-1.5 text-sm font-semibold leading-snug text-text">{paper.title}</div>
        <div className="mb-2 text-[13px] text-text-muted">
          {paper.authors.slice(0, 5).join(", ")}
          {paper.authors.length > 5 ? `, +${paper.authors.length - 5} more` : ""}
        </div>
        <div className="mb-1 flex flex-wrap items-center gap-2.5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Book size={12} />
            {paper.journal ? `${paper.journal}, ` : ""}
            {paper.year}
            {paper.citations != null ? `, ${paper.citations} citations` : ""}
          </span>
          {paper.doi && (
            <span className="inline-flex items-center gap-1 rounded bg-chip-bg px-1.5 py-0.5 font-medium">
              <Link size={10} /> DOI
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-text-muted">
          <FileText size={12} />
          {paper.fullTextAvailable ? "Full text" : "Abstract only"}
        </div>
      </div>
      <div className="text-sm leading-relaxed text-text">
        {paper.summary || paper.abstract}
        {paper.summary && <Cite n={idx + 1} />}
        {screening && (
          <div
            className={cn(
              "mt-3 rounded-md border px-2.5 py-1.5 text-[12.5px] leading-snug",
              DECISION_STYLE[screening.decision].rationaleCls
            )}
          >
            <span className="font-semibold">
              {DECISION_STYLE[screening.decision].why}:
            </span>{" "}
            <span className="opacity-90">{screening.rationale}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type FilterMode = "all" | "include" | "maybe" | "exclude";

export function SearchView({ report }: { report: Report }) {
  const { show } = useToast();
  const router = useRouter();
  const [query, setQuery] = useState(report.question);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Track which papers are already in the library so we can render a "Saved"
  // state per row. Subscribes so saves from other views reflect here too.
  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getLibrary().map((e) => e.paper.id)));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  const sourceLabel = report.question.slice(0, 60);

  const allResults = report.searchResults ?? [];
  const screening = report.screening;
  const criterion = screening?.criteria[0];

  // Criterion editor — local state for the input + submission status.
  const [editing, setEditing] = useState(false);
  const [draftCriterion, setDraftCriterion] = useState(criterion?.text ?? "");
  const [rescreening, setRescreening] = useState(false);
  // Fixture reports use slug ids — only hex run ids are editable.
  const editable = /^[0-9a-f]+$/i.test(report.id) && report.id.length <= 10;

  const applyCriterion = async () => {
    const text = draftCriterion.trim();
    if (!text || rescreening) return;
    setRescreening(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/rescreen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterion: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        show(body.error ?? "Rescreen failed");
        return;
      }
      // Pipeline now runs async with full cascade (screen → extract → synth).
      // Land the user on the live-progress view so they can watch.
      router.push(`/report/${report.id}/gather`);
    } catch {
      show("Network error during rescreen");
    } finally {
      setRescreening(false);
    }
  };

  // Index screening results by paperId for O(1) lookup at render time.
  const resultByPaper = useMemo(() => {
    const m = new Map<string, ScreeningResult>();
    screening?.results.forEach((r) => m.set(r.paperId, r));
    return m;
  }, [screening]);

  const counts = useMemo(() => {
    const out = { include: 0, maybe: 0, exclude: 0, unscreened: 0 };
    allResults.forEach((p) => {
      const r = resultByPaper.get(p.id);
      if (!r) out.unscreened++;
      else out[r.decision]++;
    });
    return out;
  }, [allResults, resultByPaper]);

  const displayed = useMemo(() => {
    if (filter === "all") return allResults;
    return allResults.filter((p) => resultByPaper.get(p.id)?.decision === filter);
  }, [allResults, resultByPaper, filter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); show("Re-running search…"); }}
          className="flex flex-1 items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5"
        >
          <Search size={16} className="flex-shrink-0 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </form>
        <button className="btn" onClick={() => show("Feedback opened")}>
          <MessageSquare size={13} /> Send feedback
        </button>
      </div>

      {criterion && (
        <div className="mb-4 rounded-[10px] border border-border bg-teal-light/40 px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-bright">
              <Sparkles size={11} /> Screening criterion
            </div>
            {editable && !editing && (
              <button
                onClick={() => {
                  setDraftCriterion(criterion.text);
                  setEditing(true);
                }}
                className="text-[11px] font-semibold text-teal-bright hover:underline"
              >
                Edit & re-screen
              </button>
            )}
          </div>

          {!editing ? (
            <div className="mb-2 text-sm text-text">{criterion.text}</div>
          ) : (
            <div className="mb-2">
              <textarea
                value={draftCriterion}
                onChange={(e) => setDraftCriterion(e.target.value)}
                disabled={rescreening}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-teal disabled:opacity-60"
                placeholder="A one-sentence inclusion criterion…"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={applyCriterion}
                  disabled={!draftCriterion.trim() || rescreening}
                  className="btn btn-primary disabled:opacity-60"
                >
                  {rescreening ? "Re-screening…" : "Apply & re-screen"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraftCriterion(criterion.text);
                  }}
                  disabled={rescreening}
                  className="btn"
                >
                  Cancel
                </button>
                <span className="text-xs text-text-muted">
                  Resets extraction + report.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {(["all", "include", "maybe", "exclude"] as const).map((mode) => {
              const count =
                mode === "all"
                  ? allResults.length
                  : counts[mode];
              const active = filter === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-medium transition-colors",
                    active
                      ? "border-teal bg-teal text-white"
                      : "border-border-strong bg-surface text-text-muted hover:text-text"
                  )}
                >
                  {mode === "all"
                    ? `All (${count})`
                    : `${mode[0].toUpperCase()}${mode.slice(1)} (${count})`}
                </button>
              );
            })}
            {counts.unscreened > 0 && (
              <span className="text-text-muted">
                · {counts.unscreened} unscreened (no abstract)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => show("Sort changed")}>
          <Sort size={12} /> Sort: Most relevant
        </button>
        <button className="btn" onClick={() => show("Search opened")}>
          <Search size={12} /> Search
        </button>
        <button className="btn" onClick={() => show("Export menu")}>
          <Download size={12} /> Export
          <span className="ml-1 rounded bg-teal-light px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-teal-bright">
            UPGRADE
          </span>
        </button>
        {bannerOpen && (
          <div className="inline-flex items-center gap-2 rounded-md bg-teal-light px-2.5 py-1.5 text-[13px] text-teal-bright">
            <FileText size={14} /> Get full-texts?
            <button onClick={() => setBannerOpen(false)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
        <div className="grid grid-cols-2 border-b border-border bg-surface-muted px-4 py-3.5 text-[13px] font-semibold">
          <span>
            Paper <span className="ml-2 font-normal text-text-muted">{displayed.length} of {allResults.length} sources</span>
          </span>
          <span>Summary</span>
        </div>
        {displayed.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            {allResults.length === 0 ? "No results yet." : "No papers match the current filter."}
          </div>
        ) : (
          displayed.map((r, i) => (
            <Result
              key={r.id}
              paper={r}
              idx={i}
              screening={resultByPaper.get(r.id)}
              sourceLabel={sourceLabel}
              saved={savedIds.has(r.id)}
              onSave={() => {
                const added = addToLibrary([r], sourceLabel);
                if (added > 0) show("Saved to library");
                else show("Already in your library");
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
