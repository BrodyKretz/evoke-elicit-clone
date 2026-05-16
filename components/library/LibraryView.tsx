"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getLibrary,
  removeFromLibrary,
  clearLibrary,
  subscribeLibrary,
  type LibraryEntry,
} from "@/lib/library";
import { pinPaper, subscribeNotebook, getNotebook } from "@/lib/notebook";
import { useToast } from "@/components/ui/Toast";
import {
  Book,
  Check,
  Download,
  FileText,
  Link as LinkIcon,
  Search,
  Sort,
  Sparkles,
  X,
} from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { formatApa, formatBibtex } from "@/lib/utils/citation";

type SortKey = "savedAt" | "title" | "year" | "cited";
const SORT_LABELS: Record<SortKey, string> = {
  savedAt: "Recently saved",
  title: "Title (A→Z)",
  year: "Most recent",
  cited: "Most cited",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function LibraryView() {
  const { show } = useToast();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("savedAt");
  const [sortOpen, setSortOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setEntries(getLibrary());
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setPinnedIds(new Set(getNotebook().pinnedPaperIds));
    refresh();
    return subscribeNotebook(refresh);
  }, []);

  const copyCitation = async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      show(`Copied ${label}`);
    } catch {
      show(`Couldn't copy ${label}`);
    }
  };

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortOpen]);

  // Distinct source labels in insertion order, capped so the chip row stays
  // readable. Sources past the cap are still reachable by typing in search.
  const sources = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      const s = (e.source ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (sourceFilter && (e.source ?? "") !== sourceFilter) return false;
      if (!q) return true;
      const hay = [
        e.paper.title,
        e.paper.authors.join(" "),
        e.paper.journal ?? "",
        e.source ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    const sorted = [...filtered];
    if (sortBy === "title") sorted.sort((a, b) => a.paper.title.localeCompare(b.paper.title));
    else if (sortBy === "year") sorted.sort((a, b) => (b.paper.year || 0) - (a.paper.year || 0));
    else if (sortBy === "cited") sorted.sort((a, b) => (b.paper.citations ?? 0) - (a.paper.citations ?? 0));
    else sorted.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return sorted;
  }, [entries, query, sortBy, sourceFilter]);

  const downloadCsv = () => {
    if (visible.length === 0) {
      show("Library is empty");
      return;
    }
    const esc = (s: string) => {
      const t = s.replaceAll("\r", "").replaceAll("\n", " ");
      return /[",]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
    };
    const lines = [
      ["Title", "Authors", "Year", "Journal", "Citations", "DOI", "Saved", "Source"].map(esc).join(","),
    ];
    for (const e of visible) {
      lines.push(
        [
          e.paper.title,
          e.paper.authors.join("; "),
          String(e.paper.year ?? ""),
          e.paper.journal ?? "",
          String(e.paper.citations ?? ""),
          e.paper.doi ?? "",
          e.savedAt,
          e.source ?? "",
        ]
          .map(esc)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evoke-library-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show(`Downloaded ${visible.length} entries`);
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-10 text-[#1F2937]">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Library</h1>
      <p className="mb-6 max-w-2xl text-[14.5px] leading-relaxed text-[#5D5D5D]">
        Papers you&apos;ve saved across runs. Click any entry to open its DOI;
        download the whole library as CSV.
      </p>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#FAFAF9] p-10 text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-white text-[#6B7280]">
            <Book size={18} />
          </div>
          <h3 className="mb-1 text-base font-semibold text-[#1F2937]">No saved papers yet</h3>
          <p className="mx-auto mb-5 max-w-md text-[13px] text-[#6B7280]">
            Hit{" "}
            <span className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-1.5 py-0.5 font-medium">
              <Book size={11} /> Save to library
            </span>{" "}
            on any extraction row or search result. Saved papers persist across
            sessions in your browser.
          </p>
          <Link
            href="/research-agent"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1F6E68] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#185650]"
          >
            <Sparkles size={12} /> Start a research run
          </Link>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-1 min-w-[200px] items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5">
              <Search size={13} className="text-[#6B7280]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved papers…"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <div ref={sortRef} className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[13px] text-[#1F2937] hover:bg-[#F3F4F6]",
                  sortBy !== "savedAt" && "border-[#1F6E68] text-[#1F6E68]"
                )}
              >
                <Sort size={12} /> Sort: {SORT_LABELS[sortBy]}
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-[220px] rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-md">
                  {(["savedAt", "year", "cited", "title"] as SortKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setSortBy(k);
                        setSortOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-[#F3F4F6]"
                    >
                      <span className={sortBy === k ? "font-semibold text-[#1F6E68]" : "text-[#1F2937]"}>
                        {SORT_LABELS[k]}
                      </span>
                      {sortBy === k && <Check size={12} className="text-[#1F6E68]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[13px] text-[#1F2937] hover:bg-[#F3F4F6]"
            >
              <Download size={12} /> Download CSV
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Clear all ${entries.length} saved papers? This can't be undone.`)) {
                  clearLibrary();
                  show("Library cleared");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[13px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
            >
              <X size={12} /> Clear all
            </button>
          </div>

          {/* Source filter chips — only render when there's >1 distinct source */}
          {sources.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-[#6B7280]">Source:</span>
              <button
                onClick={() => setSourceFilter(null)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors",
                  sourceFilter === null
                    ? "border-[#1F6E68] bg-[#1F6E68] text-white"
                    : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F3F4F6]"
                )}
              >
                All
              </button>
              {sources.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                  className={cn(
                    "max-w-[200px] truncate rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors",
                    sourceFilter === s
                      ? "border-[#1F6E68] bg-[#1F6E68] text-white"
                      : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F3F4F6]"
                  )}
                  title={s}
                >
                  {s.length > 32 ? s.slice(0, 32) + "…" : s}
                </button>
              ))}
            </div>
          )}

          {/* Counts */}
          <div className="mb-3 text-[12px] text-[#6B7280]">
            {visible.length} of {entries.length} {entries.length === 1 ? "paper" : "papers"}
            {query && ` matching "${query}"`}
            {sourceFilter && ` from "${sourceFilter}"`}
          </div>

          {/* List */}
          <ul className="flex flex-col gap-2.5">
            {visible.map((e) => (
              <li
                key={e.paper.id}
                className="group rounded-xl border border-[#E5E7EB] bg-white p-4 transition-colors hover:bg-[#FAFAFA]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1.5 text-[15px] font-semibold leading-snug text-[#1F2937]">
                      {e.paper.title}
                    </h3>
                    <div className="mb-1.5 text-[13px] text-[#6B7280]">
                      {e.paper.authors.slice(0, 4).join(", ")}
                      {e.paper.authors.length > 4 ? ` +${e.paper.authors.length - 4} more` : ""}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#6B7280]">
                      {e.paper.journal && (
                        <span className="inline-flex items-center gap-1">
                          <Book size={10} />
                          {e.paper.journal}
                          {e.paper.year ? ` · ${e.paper.year}` : ""}
                        </span>
                      )}
                      {e.paper.citations != null && <span>{e.paper.citations} citations</span>}
                      {e.paper.doi && (
                        <a
                          href={`https://doi.org/${e.paper.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-1.5 py-0.5 font-medium hover:text-[#1F6E68]"
                        >
                          <LinkIcon size={9} /> DOI
                        </a>
                      )}
                      <span className="text-[#9CA3AF]">· saved {formatWhen(e.savedAt)}</span>
                      {e.source && <span className="text-[#9CA3AF]">· from {e.source}</span>}
                    </div>
                    {e.paper.abstract && (
                      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#1F2937]/90">
                        {e.paper.abstract}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {pinnedIds.has(e.paper.id) ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-[#E6F4F2] px-2 py-0.5 text-[11px] font-medium text-[#1F6E68]"
                        title="Already pinned in Notebook"
                      >
                        <Check size={10} /> Pinned
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (pinPaper(e.paper.id)) show("Pinned to notebook");
                        }}
                        className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                        title="Pin to notebook"
                      >
                        <Book size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyCitation(formatApa(e.paper), "APA citation")}
                      className="rounded-md px-1.5 py-1 text-[10.5px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                      title="Copy APA citation"
                    >
                      APA
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCitation(formatBibtex(e.paper), "BibTeX entry")}
                      className="rounded-md px-1.5 py-1 text-[10.5px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                      title="Copy BibTeX entry"
                    >
                      BibTeX
                    </button>
                    <button
                      onClick={() => {
                        removeFromLibrary(e.paper.id);
                        show("Removed from library");
                      }}
                      className="rounded-md p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                      title="Remove from library"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="rounded-md border border-[#E5E7EB] bg-[#FAFAF9] px-4 py-6 text-center text-[13px] text-[#6B7280]">
                No saved papers match &ldquo;{query}&rdquo;.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
