"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "@/lib/types";
import { Book, Grid, Search, User } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSelectedPapers, subscribeSelection } from "@/lib/lab/selection";
import { getLibrary, subscribeLibrary } from "@/lib/library";

type ExtractRow = {
  paperId: string;
  paperTitle: string;
  paperYear: number;
  paperAuthors: string[];
  cells: string[];
  evidence?: { quotes: string[] }[];
};

type ExtractResult = {
  columns: string[];
  rows: ExtractRow[];
  skipped: number;
};

export function LabExtract() {
  const { show } = useToast();
  const [selPapers, setSelPapers] = useState<Paper[]>([]);
  const [libPapers, setLibPapers] = useState<Paper[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSelPapers(getSelectedPapers());
    refresh();
    return subscribeSelection(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setLibPapers(getLibrary().map((e) => e.paper));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  const { pool, originById } = useMemo(() => {
    const seen = new Set<string>();
    const merged: Paper[] = [];
    const selIds = new Set(selPapers.map((p) => p.id));
    const libIds = new Set(libPapers.map((p) => p.id));
    const origin: Record<string, "selection" | "library" | "both"> = {};

    for (const p of selPapers) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
      origin[p.id] = libIds.has(p.id) ? "both" : "selection";
    }
    for (const p of libPapers) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
      if (!origin[p.id]) {
        origin[p.id] = selIds.has(p.id) ? "both" : "library";
      }
    }

    return { pool: merged, originById: origin };
  }, [selPapers, libPapers]);

  const seenIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of pool) {
        if (!seenIds.current.has(p.id)) {
          next.add(p.id); // newly-appeared paper defaults to selected
          seenIds.current.add(p.id);
        }
      }
      const poolIds = new Set(pool.map((p) => p.id));
      for (const id of [...next]) if (!poolIds.has(id)) next.delete(id); // prune removed
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.map((p) => p.id).join(",")]);

  const chosen = pool.filter((p) => selectedIds.has(p.id));

  const run = async () => {
    const q = question.trim();
    if (!q || running || chosen.length === 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers: chosen, question: q }),
      });
      const body = (await res.json().catch(() => ({}))) as ExtractResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Extraction failed");
        return;
      }
      setResult(body);
      if (body.skipped > 0) {
        show(`${body.skipped} paper(s) skipped — no abstract available`);
      }
    } catch {
      setError("Network error.");
    } finally {
      setRunning(false);
    }
  };

  if (pool.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-transparent bg-surface dark:bg-[#1F1F1F] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-text-muted dark:text-[#B4B4B4]">
          Lab · Tool
        </div>
        <h1 className="mb-3 font-display text-3xl font-medium tracking-tight text-text dark:text-[#ECECEC]">
          Extract data
        </h1>
        <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-text-muted dark:text-[#B4B4B4]">
          No papers yet. Save papers to your Library, or select them in Find papers.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/lab/find"
            className="inline-flex items-center gap-1 rounded-md border border-teal bg-teal px-3 py-1.5 text-[13px] font-medium text-white hover:bg-teal-hover hover:border-teal-hover"
          >
            <Search size={12} /> Find papers
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center gap-1 rounded-md border border-border dark:border-[#2F2F2F] bg-surface dark:bg-[#1F1F1F] px-3 py-1.5 text-[13px] font-medium text-text dark:text-[#ECECEC] hover:opacity-80"
          >
            <Book size={12} /> View library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-1 inline-flex items-center gap-1.5 self-start rounded-full border border-transparent bg-surface dark:bg-[#1F1F1F] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-text-muted dark:text-[#B4B4B4]">
        Lab · Tool
      </div>
      <h1 className="mb-2 font-display text-2xl font-medium tracking-tight text-text dark:text-[#ECECEC]">
        Extract data from {chosen.length} paper{chosen.length === 1 ? "" : "s"}
      </h1>
      <p className="mb-5 max-w-2xl text-[13px] text-text-muted dark:text-[#B4B4B4]">
        Columns are auto-generated by Sonnet 4.6 from your guiding question, then each
        paper&apos;s abstract is parsed into row values with per-cell evidence quotes.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mb-6 overflow-hidden rounded-2xl border border-border dark:border-[#2F2F2F] shadow-sm"
      >
        <div className="flex items-center bg-teal px-4 py-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white">
            <Grid size={14} /> Extract data
          </span>
        </div>
        <div className="bg-surface dark:bg-[#1F1F1F] px-4 py-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
            rows={3}
            placeholder="What question should this extraction answer? (guides which columns get generated)"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-text dark:text-[#ECECEC] outline-none placeholder:text-text-faint dark:placeholder:text-[#8E8E8E]"
            disabled={running}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-text-faint dark:text-[#8E8E8E]">Try an example</span>
            {[
              "Efficacy outcomes by study design",
              "Sample size and population",
              "Reported limitations",
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                disabled={running}
                className="rounded-md bg-surface-muted dark:bg-[#2A2A2A] px-3 py-1.5 text-[13px] text-text dark:text-[#ECECEC] hover:opacity-80 disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border dark:border-[#2F2F2F] bg-surface dark:bg-[#1F1F1F] px-4 py-2.5">
          <span className="text-[12px] text-text-faint dark:text-[#8E8E8E]">
            {chosen.length} paper{chosen.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="submit"
            disabled={!question.trim() || running || chosen.length === 0}
            className="rounded-full bg-teal px-4 py-1.5 text-[13px] font-medium text-white hover:bg-teal-hover disabled:opacity-50"
          >
            {running ? "Extracting…" : "Run extract"}
          </button>
        </div>
      </form>

      <div className="mb-6 rounded-[10px] border border-border dark:border-[#2F2F2F] bg-surface dark:bg-[#1F1F1F]">
        <div className="flex items-center justify-between border-b border-border dark:border-[#2F2F2F] px-4 py-2.5">
          <span className="text-[13px] font-medium text-text dark:text-[#ECECEC]">Papers · {chosen.length} of {pool.length} selected</span>
          <button type="button" onClick={() => setSelectedIds(chosen.length === pool.length ? new Set() : new Set(pool.map(p => p.id)))} className="text-[12px] font-medium text-teal hover:underline">{chosen.length === pool.length ? "Select none" : "Select all"}</button>
        </div>
        <ul className="max-h-64 overflow-y-auto">
          {pool.map(p => {
            const on = selectedIds.has(p.id);
            const origin = originById[p.id];
            return (
              <li key={p.id} className="flex items-center gap-3 border-b border-border dark:border-[#2F2F2F] px-4 py-2 last:border-b-0">
                <input type="checkbox" checked={on} onChange={() => setSelectedIds(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} className="h-4 w-4 accent-teal" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-text dark:text-[#ECECEC]">{p.title}</div>
                  <div className="truncate text-[11.5px] text-text-faint dark:text-[#8E8E8E]">{p.authors?.slice(0,2).join(", ")}{p.authors && p.authors.length > 2 ? " et al." : ""} · {p.year || "n.d."}</div>
                </div>
                <span className="flex-shrink-0 rounded-full bg-surface-muted dark:bg-[#2A2A2A] px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-text-faint dark:text-[#8E8E8E]">{origin === "both" ? "Both" : origin === "library" ? "Library" : "Selection"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div className="mb-6 rounded-[10px] bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {running && (
        <div className="mb-6 rounded-[10px] border border-transparent bg-surface dark:bg-[#1F1F1F] px-4 py-6 text-center text-sm text-text-muted dark:text-[#B4B4B4]">
          Running Sonnet 4.6 against {chosen.length} paper{chosen.length === 1 ? "" : "s"}…
        </div>
      )}

      {result && (
        <div className="overflow-x-auto rounded-[10px] border border-transparent bg-surface dark:bg-[#1F1F1F]">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-transparent bg-surface-muted dark:bg-[#2A2A2A] text-left">
                <th className="px-3 py-2.5 font-semibold text-text dark:text-[#ECECEC]">Paper</th>
                {result.columns.map((c) => (
                  <th key={c} className="px-3 py-2.5 font-semibold text-text dark:text-[#ECECEC]">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.paperId} className="border-b border-transparent last:border-b-0">
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-text dark:text-[#ECECEC]">{row.paperTitle}</div>
                    <div className="mt-0.5 text-text-muted dark:text-[#B4B4B4]">
                      <User size={9} className="mr-1 inline" />
                      {row.paperAuthors.slice(0, 2).join(", ")}
                      {row.paperAuthors.length > 2 ? " et al." : ""} ·{" "}
                      <Book size={9} className="ml-1 mr-0.5 inline" />
                      {row.paperYear || "n.d."}
                    </div>
                  </td>
                  {row.cells.map((cell, i) => {
                    const quotes = row.evidence?.[i]?.quotes ?? [];
                    return (
                      <td key={i} className="px-3 py-3 align-top text-text dark:text-[#ECECEC]">
                        <div className="whitespace-pre-wrap">{cell}</div>
                        {quotes.length > 0 && (
                          <details className="mt-1.5 text-text-muted dark:text-[#B4B4B4]">
                            <summary className="cursor-pointer text-[11px] font-medium text-text dark:text-[#ECECEC] hover:underline">
                              {quotes.length} quote{quotes.length === 1 ? "" : "s"} from abstract
                            </summary>
                            <ul className="mt-1 space-y-1 pl-2 text-[11.5px] italic">
                              {quotes.map((qq, j) => (
                                <li key={j}>&ldquo;{qq}&rdquo;</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
