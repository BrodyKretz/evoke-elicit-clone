"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import {
  Book,
  Check,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Link as LinkIcon,
  Search,
  Sort,
} from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { addToLibrary } from "@/lib/library";
import { LiveProgressFeed } from "@/components/progress/LiveProgressFeed";

// Two-pane extraction view: left rail shows the run's framing (question,
// criterion, source counts) and the right pane is the working table with
// search/sort/filter/multi-select. Visual structure matches the Elicit
// reference; the data shown is Evoke's real per-paper extraction grid.

type SortKey = "relevance" | "title" | "year" | "cited";

const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Most relevant",
  title: "Title (A→Z)",
  year: "Most recent",
  cited: "Most cited",
};

const STUDY_TYPES = ["Review", "Meta-Analysis", "Systematic Review"];

export function ExtractionView({ report }: { report: Report }) {
  const { show } = useToast();
  const ext = report.extraction;

  // Empty state.
  if (!ext) {
    return (
      <div className="rounded-[10px] border border-border bg-surface p-8 text-center text-text-muted">
        Extraction has not run yet. Once papers are screened, structured data will appear here.
      </div>
    );
  }

  const totalRows = ext.rows.length;
  const totalCols = ext.columns.length;
  const dataPoints = totalRows * totalCols;
  const screenIncluded = report.status.screen.sourcesIncluded;

  // ---- UI state ----
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pdfOnly, setPdfOnly] = useState(false);
  const [yearMin, setYearMin] = useState<number | "">("");
  const [yearMax, setYearMax] = useState<number | "">("");
  const [studyTypes, setStudyTypes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sortOpen && !filtersOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortOpen, filtersOpen]);

  // ---- Filtering + sorting ----
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const yMin = typeof yearMin === "number" ? yearMin : -Infinity;
    const yMax = typeof yearMax === "number" ? yearMax : Infinity;
    const rows = ext.rows.filter((row) => {
      const haystack = [
        row.paper.title,
        row.paper.authors.join(" "),
        row.paper.journal ?? "",
        ...row.cells,
      ]
        .join(" \n ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (pdfOnly && !row.paper.fullTextAvailable) return false;
      if (row.paper.year < yMin || row.paper.year > yMax) return false;
      // study type filter: do a best-effort substring match on the row's
      // cells (the model often tags "review" / "meta-analysis" in the
      // methodology cell).
      if (studyTypes.size > 0) {
        const cellsLower = row.cells.join(" ").toLowerCase();
        const hit = Array.from(studyTypes).some((t) =>
          cellsLower.includes(t.toLowerCase())
        );
        if (!hit) return false;
      }
      return true;
    });
    const sorted = [...rows];
    if (sortBy === "title") sorted.sort((a, b) => a.paper.title.localeCompare(b.paper.title));
    else if (sortBy === "year") sorted.sort((a, b) => (b.paper.year || 0) - (a.paper.year || 0));
    else if (sortBy === "cited") sorted.sort((a, b) => (b.paper.citations ?? 0) - (a.paper.citations ?? 0));
    // relevance: keep input order (mirrors corpus relevance ranking).
    return sorted;
  }, [ext.rows, query, sortBy, pdfOnly, yearMin, yearMax, studyTypes]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.paper.id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected((cur) => {
        const next = new Set(cur);
        visibleRows.forEach((r) => next.delete(r.paper.id));
        return next;
      });
    } else {
      setSelected((cur) => {
        const next = new Set(cur);
        visibleRows.forEach((r) => next.add(r.paper.id));
        return next;
      });
    }
  };
  const toggleOne = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- CSV download ----
  const downloadCsv = (subsetIds?: Set<string>) => {
    const rowsForExport = subsetIds && subsetIds.size > 0
      ? ext.rows.filter((r) => subsetIds.has(r.paper.id))
      : visibleRows;
    if (rowsForExport.length === 0) {
      show("Nothing to download");
      return;
    }
    const esc = (s: string) => {
      const t = s.replaceAll("\r", "").replaceAll("\n", " ");
      return /[",]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
    };
    const headerCols = ["Title", "Authors", "Year", "Journal", "DOI", ...ext.columns];
    const lines = [headerCols.map(esc).join(",")];
    for (const r of rowsForExport) {
      lines.push(
        [
          r.paper.title,
          r.paper.authors.join("; "),
          String(r.paper.year ?? ""),
          r.paper.journal ?? "",
          r.paper.doi ?? "",
          ...r.cells,
        ]
          .map(esc)
          .join(",")
      );
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = report.question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    a.href = url;
    a.download = `${slug || "evoke-extraction"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show(`Downloaded ${rowsForExport.length} row${rowsForExport.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="flex min-h-[600px] gap-6">
      {/* ---- Left rail: prompt summary + live/static progress feed ---- */}
      <aside className="flex w-[320px] flex-shrink-0 flex-col gap-3">
        <div className="rounded-[12px] border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Your prompt
          </div>
          <div className="mb-3 rounded-md bg-surface-muted px-3 py-2.5 text-[13.5px] leading-snug text-text">
            &ldquo;{report.question}&rdquo;
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-text-muted">
            <div>
              <span className="font-semibold text-text">
                {report.status.gather.sourcesFound ?? totalRows}
              </span>{" "}
              gathered
            </div>
            <div>
              <span className="font-semibold text-text">{screenIncluded ?? totalRows}</span> included
            </div>
            <div>
              <span className="font-semibold text-text">{dataPoints}</span> data points
            </div>
            <div>
              <span className="font-semibold text-text">{totalCols}</span> columns
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-2.5 text-[11px] text-text-faint">
            Showing {visibleRows.length} of {totalRows} rows
          </div>
        </div>

        <LiveProgressFeed report={report} />
      </aside>

      {/* ---- Right pane: table ---- */}
      <section className="min-w-0 flex-1">
        {/* Title chip */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
          <FileText size={13} className="text-text-muted" />
          <span className="text-[13px] font-medium text-text">{report.question}</span>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="inline-flex flex-1 min-w-[200px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
            <Search size={13} className="text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-faint"
            />
          </div>

          {/* Sort */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => {
                setSortOpen((v) => !v);
                setFiltersOpen(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted",
                sortBy !== "relevance" && "border-teal text-teal"
              )}
            >
              <Sort size={12} /> Sort: {SORT_LABELS[sortBy]}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-md">
                {(["relevance", "year", "cited", "title"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSortBy(k);
                      setSortOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-muted"
                  >
                    <span className={sortBy === k ? "font-semibold text-teal" : "text-text"}>
                      {k === "relevance" ? "Relevance" : k === "year" ? "Recency" : k === "cited" ? "Cited" : "Title"}
                    </span>
                    {sortBy === k && <Check size={12} className="text-teal" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div ref={filtersRef} className="relative">
            <button
              onClick={() => {
                setFiltersOpen((v) => !v);
                setSortOpen(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted",
                (pdfOnly || yearMin !== "" || yearMax !== "" || studyTypes.size > 0) && "border-teal text-teal"
              )}
            >
              <Filter size={12} /> Filters
              {(pdfOnly || yearMin !== "" || yearMax !== "" || studyTypes.size > 0) && (
                <span className="ml-1 rounded-full bg-teal px-1.5 text-[10px] font-bold text-white">
                  {[
                    pdfOnly && "pdf",
                    yearMin !== "" && "min",
                    yearMax !== "" && "max",
                    studyTypes.size > 0 && `t${studyTypes.size}`,
                  ].filter(Boolean).length}
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-[300px] rounded-lg border border-border bg-surface p-4 shadow-md">
                <label className="mb-3 flex items-center justify-between text-[13px] font-medium text-text">
                  <span>Source has PDF</span>
                  <input
                    type="checkbox"
                    checked={pdfOnly}
                    onChange={(e) => setPdfOnly(e.target.checked)}
                    className="h-4 w-4 accent-teal"
                  />
                </label>

                <div className="mb-3 border-t border-border pt-3 text-[13px] font-medium text-text">
                  Publication year
                </div>
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="From"
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[13px] outline-none focus:border-teal"
                  />
                  <input
                    type="number"
                    placeholder="To"
                    value={yearMax}
                    onChange={(e) => setYearMax(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[13px] outline-none focus:border-teal"
                  />
                </div>

                <div className="mb-2 text-[13px] font-medium text-text">Study type</div>
                <div className="flex flex-col gap-1.5">
                  {STUDY_TYPES.map((t) => {
                    const on = studyTypes.has(t);
                    return (
                      <label key={t} className="flex items-center gap-2 text-[13px] text-text">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setStudyTypes((cur) => {
                              const next = new Set(cur);
                              if (e.target.checked) next.add(t);
                              else next.delete(t);
                              return next;
                            })
                          }
                          className="h-4 w-4 accent-teal"
                        />
                        {t}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <button
                    onClick={() => {
                      setPdfOnly(false);
                      setYearMin("");
                      setYearMax("");
                      setStudyTypes(new Set());
                    }}
                    className="text-[12px] text-text-muted hover:text-text"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-md bg-teal px-2.5 py-1 text-[12px] font-medium text-white hover:bg-teal-hover"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => downloadCsv()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted"
            title="Download all visible rows as CSV"
          >
            <Download size={12} /> Download
          </button>

          <button
            onClick={() => {
              const papers = visibleRows.map((r) => r.paper);
              const added = addToLibrary(papers, report.question.slice(0, 60));
              if (added > 0) show(`Saved ${added} to library`);
              else show("All visible papers are already in your library");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted"
            title="Save all visible sources to your library"
          >
            <Book size={12} /> Save to library
          </button>
        </div>

        {/* Selection action bar */}
        {selected.size > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-teal bg-teal-light/50 px-3 py-1.5 text-[13px] text-teal-bright">
            <span className="font-medium">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadCsv(selected)}
                className="inline-flex items-center gap-1 rounded-md bg-teal px-2.5 py-1 text-[12.5px] font-medium text-white hover:bg-teal-hover"
              >
                <Download size={11} /> Download {selected.size}
              </button>
              <button
                onClick={() => {
                  const papers = ext.rows
                    .filter((r) => selected.has(r.paper.id))
                    .map((r) => r.paper);
                  const added = addToLibrary(papers, report.question.slice(0, 60));
                  if (added > 0) show(`Saved ${added} to library`);
                  else show("All selected papers are already in your library");
                }}
                className="inline-flex items-center gap-1 rounded-md border border-teal bg-surface px-2.5 py-1 text-[12.5px] font-medium text-teal hover:bg-teal-light hover:text-teal-bright"
              >
                <Book size={11} /> Save {selected.size}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[12px] text-text-muted hover:text-text"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-muted">
                <th className="w-9 border-b border-border px-3 py-2.5 text-left">
                  <input
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-teal"
                    aria-label="Select all"
                  />
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left align-top text-[12.5px] font-semibold text-text" style={{ width: "30%" }}>
                  Source ({visibleRows.length}{selected.size > 0 ? `, ${selected.size} selected` : ""})
                </th>
                {ext.columns.map((c, i) => (
                  <th
                    key={i}
                    className="border-b border-border px-3 py-2.5 text-left align-top text-[12.5px] font-semibold text-text"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={2 + ext.columns.length} className="px-4 py-8 text-center text-sm text-text-muted">
                    No rows match the current search/filters.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const checked = selected.has(row.paper.id);
                return (
                  <tr
                    key={row.paper.id}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-surface-muted",
                      checked && "bg-teal-light/30"
                    )}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(row.paper.id)}
                        className="mt-0.5 h-4 w-4 accent-teal"
                        aria-label={`Select ${row.paper.title}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-sm">
                      <div className="mb-1 font-semibold leading-snug text-text">{row.paper.title}</div>
                      <div className="mb-1 text-[12.5px] text-text-muted">
                        {row.paper.authors.slice(0, 4).join(", ")}
                        {row.paper.authors.length > 4 ? `, +${row.paper.authors.length - 4} more` : ""}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-muted">
                        {row.paper.journal && (
                          <span className="inline-flex items-center gap-1">
                            <Book size={10} /> {row.paper.journal}
                            {row.paper.year ? ` · ${row.paper.year}` : ""}
                          </span>
                        )}
                        {row.paper.citations != null && (
                          <span>{row.paper.citations} citations</span>
                        )}
                        {row.paper.doi && (
                          <a
                            href={`https://doi.org/${row.paper.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-chip-bg px-1.5 py-0.5 font-medium hover:text-teal"
                          >
                            <LinkIcon size={9} /> DOI
                          </a>
                        )}
                        <span className={row.paper.fullTextAvailable ? "text-teal" : "text-text-faint"}>
                          {row.paper.fullTextAvailable ? "Full text" : "Abstract only"}
                        </span>
                      </div>
                    </td>
                    {row.cells.map((cell, ci) => {
                      const quotes = row.evidence?.[ci]?.quotes ?? [];
                      return (
                        <td key={ci} className="px-3 py-3 align-top text-[13px] text-text">
                          <div className="whitespace-pre-line leading-snug">{cell}</div>
                          {quotes.length > 0 && (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer text-[11px] text-text-muted hover:text-teal">
                                {quotes.length} quote{quotes.length === 1 ? "" : "s"} from abstract
                                <ChevronRight size={10} className="ml-0.5 inline" />
                              </summary>
                              <ul className="mt-1 space-y-1 border-l-2 border-border-strong pl-2 text-[12px] italic text-text-muted">
                                {quotes.map((q, qi) => (
                                  <li key={qi}>&ldquo;{q}&rdquo;</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
