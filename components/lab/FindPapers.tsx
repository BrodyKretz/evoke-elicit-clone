"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Paper } from "@/lib/types";
import { Book, Check, Link as LinkIcon, Search, User } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getStoredCorpus, type CorpusProvider } from "@/components/home/CorpusToggle";
import { getSelectedPapers, subscribeSelection, toggleSelected } from "@/lib/lab/selection";
import { addToLibrary, getLibrary, subscribeLibrary } from "@/lib/library";
import { cn } from "@/lib/utils/cn";

export function FindPapers() {
  const { show } = useToast();
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [corpus, setCorpus] = useState<CorpusProvider>("s2");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Paper[]>([]);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Track which result papers are already in the library so we can render a
  // "Saved" state instead of a fresh Save button. Subscribed so saves from
  // elsewhere reflect here too.
  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getLibrary().map((e) => e.paper.id)));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setSelectedIds(new Set(getSelectedPapers().map((p) => p.id)));
    refresh();
    return subscribeSelection(refresh);
  }, []);

  useEffect(() => {
    setCorpus(getStoredCorpus());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<CorpusProvider>).detail;
      if (next === "s2" || next === "core") setCorpus(next);
    };
    window.addEventListener("evoke:corpus-change", onChange);
    return () => window.removeEventListener("evoke:corpus-change", onChange);
  }, []);

  const run = async (override?: string) => {
    const query = (override ?? q).trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setRan(true);
    setCorrectedQuery(null);
    try {
      const res = await fetch(
        `/api/lab/search?q=${encodeURIComponent(query)}&corpus=${corpus}&limit=25`
      );
      const body = (await res.json().catch(() => ({}))) as {
        papers?: Paper[];
        error?: string;
        correctedQuery?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Search failed");
        setResults([]);
        return;
      }
      setResults(body.papers ?? []);
      if (body.correctedQuery) setCorrectedQuery(body.correctedQuery);
    } catch {
      setError("Network error.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run when arriving with ?q= already populated (from a shell submit).
  useEffect(() => {
    if (initialQ.trim() && !ran) {
      void run(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-text">Find papers</h1>
      <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-text-muted">
        Semantic search across {corpus === "core" ? "CORE" : "Semantic Scholar"}. Returns titles,
        abstracts, authors, and DOIs. Silently auto-corrects obvious typos.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mb-6 flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-2.5 shadow-sm"
      >
        <Search size={16} className="flex-shrink-0 text-text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. cardiac remodeling after myocardial infarction in adults"
          className="flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="rounded-full bg-teal px-4 py-1.5 text-[13px] font-medium text-white hover:bg-teal-hover disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {correctedQuery && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] text-text">
          Searched as: <span className="font-semibold">{correctedQuery}</span>{" "}
          <span className="text-text-faint">(auto-corrected from a possible typo)</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-rose-50/50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {ran && !loading && !error && results.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-text-muted">
          No papers found. Try rewording or switching the corpus.
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="mb-2 text-[12px] uppercase tracking-wider text-text-faint">
            {results.length} result{results.length === 1 ? "" : "s"}
          </div>
          <ul className="flex flex-col gap-2.5">
            {results.map((p) => {
              const isSelected = selectedIds.has(p.id);
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
                          ? "border-teal bg-teal text-white"
                          : "border-border-strong text-transparent hover:border-border-strong hover:text-text"
                      )}
                    >
                      <Check size={12} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-semibold leading-snug text-text">
                          {p.title}
                        </h3>
                        {savedIds.has(p.id) ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal">
                            <Check size={10} /> Saved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const added = addToLibrary([p], "Find papers");
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
