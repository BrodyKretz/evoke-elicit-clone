"use client";

import { useMemo, useState } from "react";
import { Filter, Sort, ExternalLink } from "@/components/ui/Icon";
import { Cite } from "@/components/ui/Cite";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";

type Props = {
  columns: string[];
  rows: string[][];
  viewMore?: number;
};

type SortState = { col: number; dir: "asc" | "desc" } | null;

export function DataTable({ columns, rows, viewMore }: Props) {
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [openFilter, setOpenFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const { show } = useToast();

  const processed = useMemo(() => {
    let r = rows;
    Object.entries(filters).forEach(([colStr, q]) => {
      const col = Number(colStr);
      const needle = q.trim().toLowerCase();
      if (!needle) return;
      r = r.filter((row) => (row[col] ?? "").toLowerCase().includes(needle));
    });
    if (sort) {
      r = [...r].sort((a, b) => {
        const A = a[sort.col] ?? "";
        const B = b[sort.col] ?? "";
        const numA = parseFloat(A), numB = parseFloat(B);
        const cmp = !isNaN(numA) && !isNaN(numB) ? numA - numB : A.localeCompare(B);
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, filters, sort]);

  const handleSort = (col: number) => {
    setSort((s) => (s?.col === col ? (s.dir === "asc" ? { col, dir: "desc" } : null) : { col, dir: "asc" }));
  };

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-[10px] border border-border bg-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c, i) => {
                const sortActive = sort?.col === i;
                const filterActive = !!filters[i];
                return (
                  <th
                    key={i}
                    className="border-b border-border bg-surface px-4 py-3.5 text-left align-top text-[13px] font-semibold text-text"
                  >
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <span>{c}</span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => setOpenFilter((o) => (o === i ? null : i))}
                            className={cn(
                              "grid h-[22px] w-[22px] place-items-center rounded text-text-faint transition-colors hover:bg-surface-muted hover:text-text",
                              filterActive && "bg-teal-light text-teal"
                            )}
                            aria-label="Filter column"
                          >
                            <Filter size={12} />
                          </button>
                          <button
                            onClick={() => handleSort(i)}
                            className={cn(
                              "grid h-[22px] w-[22px] place-items-center rounded text-text-faint transition-colors hover:bg-surface-muted hover:text-text",
                              sortActive && "bg-teal-light text-teal"
                            )}
                            aria-label="Sort column"
                          >
                            <Sort size={12} />
                          </button>
                        </div>
                      </div>
                      {openFilter === i && (
                        <div className="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-lg border border-border bg-surface p-2 shadow-md">
                          <input
                            autoFocus
                            value={filters[i] ?? ""}
                            onChange={(e) => setFilters({ ...filters, [i]: e.target.value })}
                            placeholder={`Filter ${c.toLowerCase()}…`}
                            className="w-full rounded-md border border-border px-2.5 py-1.5 text-[13px] outline-none focus:border-teal"
                          />
                          <button
                            onClick={() => {
                              const { [i]: _, ...rest } = filters;
                              setFilters(rest);
                              setOpenFilter(null);
                            }}
                            className="mt-1 w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"
                          >
                            Clear filter
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processed.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0 hover:bg-surface-muted">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-4 align-top text-sm text-text">
                    <span className="whitespace-pre-line">{cell}</span>
                    <Cite n={ri * row.length + ci + 1} />
                  </td>
                ))}
              </tr>
            ))}
            {processed.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-text-muted">
                  No rows match the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {viewMore != null && viewMore > 0 && (
        <button
          onClick={() => show("Loading more rows…")}
          className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface py-3.5 text-[13px] font-medium text-teal transition-colors hover:bg-surface-muted"
        >
          <ExternalLink size={12} />
          View {viewMore} more rows
        </button>
      )}
    </>
  );
}
