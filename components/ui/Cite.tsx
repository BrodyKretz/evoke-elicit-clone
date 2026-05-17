"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";
import type { Paper } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

// Citation marker. Renders a small clickable glyph.
// When a paper is bound, clicking opens an inline popover with the paper's
// bibliographic info. Without a paper (legacy fixture data), falls back to
// a toast — preserves backwards compatibility with hand-written fixtures.

type CiteProps = {
  n?: number;
  paper?: Paper;
};

function shortRef(paper: Paper): string {
  const first = paper.authors[0] ?? "Unknown";
  const etAl = paper.authors.length > 1 ? " et al." : "";
  return `${first}${etAl} (${paper.year || "n.d."})`;
}

export function Cite({ n = 1, paper }: CiteProps) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close popover when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = () => {
    if (paper) setOpen((o) => !o);
    else show(`Citation ${n}`);
  };

  const tooltip = paper ? `[${n}] ${shortRef(paper)}` : `Citation ${n}`;

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        title={tooltip}
        className={cn(
          "ml-0.5 inline-flex h-4 min-w-[1rem] cursor-pointer items-center justify-center rounded-[3px] bg-chip-bg px-1 align-super text-[10px] leading-none text-text-muted transition-colors hover:bg-teal-light hover:text-teal-bright",
          open && "bg-teal text-white hover:bg-teal hover:text-white"
        )}
        aria-label={tooltip}
        aria-expanded={open}
      >
        {paper ? `${n}` : "✱"}
      </button>
      {open && paper && (
        <span className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-80 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left text-[13px] shadow-md">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-teal">
            Reference [{n}]
          </span>
          <span className="mb-1.5 block font-semibold leading-snug text-text">
            {paper.title}
          </span>
          <span className="mb-1 block text-text-muted">
            {paper.authors.slice(0, 4).join(", ")}
            {paper.authors.length > 4 ? `, +${paper.authors.length - 4}` : ""}
          </span>
          <span className="block text-text-muted">
            {paper.journal ? `${paper.journal}, ` : ""}
            {paper.year || "n.d."}
            {paper.citations != null ? ` · ${paper.citations} citations` : ""}
          </span>
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-teal hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              doi.org/{paper.doi}
            </a>
          )}
        </span>
      )}
    </span>
  );
}

// Render N citation marks in a row.
// - If `paperIndices` is given, each marker links to the corresponding paper.
// - Otherwise, falls back to N anonymous markers (legacy / hand-written fixtures).
export function CiteCluster({
  count,
  paperIndices,
  references,
}: {
  count?: number;
  paperIndices?: number[];
  references?: Paper[];
}) {
  if (paperIndices && paperIndices.length > 0) {
    return (
      <>
        {paperIndices.map((idx) => {
          const paper = references?.[idx - 1];
          return <Cite key={`${idx}`} n={idx} paper={paper} />;
        })}
      </>
    );
  }
  const n = count ?? 0;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <Cite key={i} n={i + 1} />
      ))}
    </>
  );
}
