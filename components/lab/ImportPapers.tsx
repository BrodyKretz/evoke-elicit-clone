"use client";

import { useEffect, useState } from "react";
import type { Paper } from "@/lib/types";
import { Book, Check, Link as LinkIcon, User } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSelectedPapers, subscribeSelection, toggleSelected } from "@/lib/lab/selection";
import { addToLibrary, getLibrary, subscribeLibrary } from "@/lib/library";
import { cn } from "@/lib/utils/cn";

// BYO papers — paste any mix of DOIs, DOI URLs, arXiv ids/links, or PubMed
// ids and resolve them to a working paper list with the same Save / Select
// affordances the rest of /lab uses.

const SAMPLE = [
  "10.1056/NEJMoa2107038",
  "https://doi.org/10.1038/s41591-021-01413-7",
  "arXiv:2401.04088",
].join("\n");

export function ImportPapers() {
  const { show } = useToast();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ parsed: number; missed: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setSelectedIds(new Set(getSelectedPapers().map((p) => p.id)));
    refresh();
    return subscribeSelection(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getLibrary().map((e) => e.paper.id)));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setRan(true);
    setStats(null);
    try {
      const res = await fetch("/api/lab/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        papers?: Paper[];
        parsedCount?: number;
        missedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Resolve failed");
        setPapers([]);
        return;
      }
      setPapers(body.papers ?? []);
      setStats({
        parsed: body.parsedCount ?? 0,
        missed: body.missedCount ?? 0,
      });
    } catch {
      setError("Network error.");
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = () => {
    if (papers.length === 0) return;
    const added = addToLibrary(papers, "BYO import");
    if (added > 0) show(`Saved ${added} to library`);
    else show("All resolved papers are already in your library");
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-text">Import papers</h1>
      <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-text-muted">
        Bring your own set. Paste any mix of DOIs, DOI URLs, arXiv ids, or PubMed ids
        (one per line, or comma-separated). They&apos;re resolved through Semantic
        Scholar and dropped into the same Lab selection / Library plumbing.
      </p>

      <div className="mb-3 rounded-xl bg-surface-muted p-3 shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste identifiers here, e.g.\n${SAMPLE}`}
          rows={6}
          className="w-full resize-y rounded-md bg-transparent px-2 py-1.5 text-[13px] text-text outline-none placeholder:text-text-faint"
          disabled={loading}
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="text-[12px] text-text-faint hover:text-text"
          >
            Insert example
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!text.trim() || loading}
            className="rounded-full bg-text px-4 py-1.5 text-[13px] font-medium text-bg hover:bg-white disabled:opacity-50"
          >
            {loading ? "Resolving…" : "Resolve papers"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-rose-50/50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {ran && !loading && !error && papers.length === 0 && (
        <div className="rounded-lg border border-border-strong bg-surface px-4 py-3 text-[13px] text-text-muted">
          No papers resolved. Check that each line has a recognizable DOI, arXiv id,
          or PubMed id.
        </div>
      )}

      {papers.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between text-[12px] text-text-muted">
            <span className="uppercase tracking-wider text-text-faint">
              {papers.length} resolved
              {stats && stats.missed > 0 && (
                <span className="ml-1.5 normal-case tracking-normal text-rose-800">
                  · {stats.missed} not found
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={saveAll}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 text-[12px] font-medium text-text hover:border-border"
            >
              <Book size={11} /> Save all {papers.length} to library
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {papers.map((p) => {
              const isSelected = selectedIds.has(p.id);
              const isSaved = savedIds.has(p.id);
              return (
                <li
                  key={p.id}
                  className={cn(
                    "rounded-xl border px-4 py-4 transition-colors",
                    isSelected
                      ? "border-border-strong bg-surface"
                      : "border-transparent bg-surface hover:bg-surface-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelected(p)}
                      aria-pressed={isSelected}
                      aria-label={isSelected ? "Remove from selection" : "Add to selection"}
                      className={cn(
                        "mt-1 grid h-5 w-5 flex-shrink-0 place-items-center rounded border-[1.5px] transition-colors",
                        isSelected
                          ? "border-text bg-text text-bg"
                          : "border-border text-transparent hover:border-border-strong hover:text-text"
                      )}
                    >
                      <Check size={12} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-semibold leading-snug text-text">
                          {p.title}
                        </h3>
                        {isSaved ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal-bright">
                            <Check size={10} /> Saved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const added = addToLibrary([p], "BYO import");
                              if (added > 0) show("Saved to library");
                              else show("Already in your library");
                            }}
                            className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text-muted hover:border-border hover:text-text"
                            title="Save to library"
                          >
                            <Book size={10} /> Save
                          </button>
                        )}
                      </div>
                      <div className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] text-text-muted">
                        <User size={12} />
                        {p.authors.slice(0, 4).join(", ")}
                        {p.authors.length > 4 ? ` +${p.authors.length - 4}` : ""}
                      </div>
                      <div className="mb-2.5 inline-flex flex-wrap items-center gap-2.5 text-[12px] text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Book size={11} />
                          {p.journal ? `${p.journal} · ` : ""}
                          {p.year || "n.d."}
                          {p.citations != null ? ` · ${p.citations} citations` : ""}
                        </span>
                        {p.doi && (
                          <a
                            href={`https://doi.org/${p.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 font-medium hover:text-text"
                          >
                            <LinkIcon size={10} /> DOI
                          </a>
                        )}
                        <span className={p.fullTextAvailable ? "text-text" : "text-text-faint"}>
                          {p.fullTextAvailable ? "Full text available" : "Abstract only"}
                        </span>
                      </div>
                      {p.abstract && (
                        <p className="text-[13px] leading-relaxed text-text">
                          {p.abstract.length > 600 ? p.abstract.slice(0, 600) + "…" : p.abstract}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
