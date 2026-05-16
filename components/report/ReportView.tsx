"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Cites, Paper, Report, ReportBlock } from "@/lib/types";
import { CiteCluster } from "@/components/ui/Cite";
import { DataTable } from "./DataTable";
import { NotesBlock } from "./NotesBlock";
import { useToast } from "@/components/ui/Toast";
import { addToLibrary, getLibrary, subscribeLibrary } from "@/lib/library";
import { Book, Check, FileText } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { formatApa, formatBibtex } from "@/lib/utils/citation";

// Inline citation marker grammar: `[[1,3]]` after a claim becomes a citation
// cluster pointing at papers 1 and 3 in the references list. The synthesizer
// now emits these so each individual sentence/claim is traceable, matching
// the Elicit reference design. Legacy fixtures without markers fall through
// to the trailing paragraph-level `cites` cluster.
const INLINE_CITE_RE = /\[\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]\]/g;

function renderParagraphText(text: string, references?: Paper[]): ReactNode[] {
  // Use matchAll so we get start/end indices without a stateful regex.
  const matches = Array.from(text.matchAll(INLINE_CITE_RE));
  if (matches.length === 0) return [text];

  const out: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, k) => {
    const start = m.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));
    const indices = m[1]
      .split(/\s*,\s*/)
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n >= 1);
    if (indices.length > 0) {
      out.push(
        <CiteCluster key={`c${k}`} paperIndices={indices} references={references} />
      );
    }
    cursor = start + m[0].length;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function renderCites(cites: Cites | undefined, references?: Paper[]) {
  if (cites == null) return null;
  if (Array.isArray(cites)) {
    return cites.length > 0 ? <CiteCluster paperIndices={cites} references={references} /> : null;
  }
  return cites > 0 ? <CiteCluster count={cites} /> : null;
}

function renderBlock(b: ReportBlock, i: number, references?: Paper[]) {
  switch (b.kind) {
    case "sectionLabel":
      return (
        <div key={i} className="section-label">
          {b.text}
        </div>
      );
    case "heading": {
      if (b.level === 2) return <h2 key={i} className="font-display text-[26px] font-medium text-text my-6">{b.text}</h2>;
      if (b.level === 3) return <h3 key={i} className="subsection-title text-center">{b.text}</h3>;
      return <h4 key={i} className="sub-subsection-title">{b.text}</h4>;
    }
    case "paragraph": {
      const hasInline = INLINE_CITE_RE.test(b.text);
      // matchAll/test share the global regex's lastIndex state — reset so
      // subsequent calls don't skip the start of the string.
      INLINE_CITE_RE.lastIndex = 0;
      if (hasInline) {
        return (
          <p key={i} className="mb-3.5 max-w-prose text-[15px] text-text">
            {renderParagraphText(b.text, references)}
          </p>
        );
      }
      return (
        <p key={i} className="mb-3.5 max-w-prose text-[15px] text-text">
          {b.text} {renderCites(b.cites, references)}
        </p>
      );
    }
    case "table":
      return <DataTable key={i} columns={b.columns} rows={b.rows} viewMore={b.viewMore} />;
    case "notes":
      return <NotesBlock key={i} title={b.title} items={b.items} />;
  }
}

export function ReportView({ report }: { report: Report }) {
  const { show } = useToast();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [methodsOpen, setMethodsOpen] = useState(false);

  // Mirror library state so individual reference rows can flip to "Saved".
  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getLibrary().map((e) => e.paper.id)));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  const sourceLabel = report.question.slice(0, 60);

  if (!report.report) {
    return (
      <div className="rounded-[10px] border border-border bg-surface p-8 text-center text-text-muted">
        Report is not yet generated. Complete the earlier pipeline steps to populate it.
      </div>
    );
  }

  return (
    <article>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-text-muted">{report.date}</span>
        <div className="flex items-center gap-2">
          {report.references && report.references.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const added = addToLibrary(report.references ?? [], sourceLabel);
                if (added > 0) show(`Saved ${added} to library`);
                else show("All references are already in your library");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text hover:bg-surface-muted"
              title="Save every reference in this report to your library"
            >
              <Book size={12} /> Save all references
            </button>
          )}
          <a
            href={`/api/reports/${report.id}/export/pptx`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text hover:bg-surface-muted"
            title="Download this report as a PowerPoint (.pptx) deck"
          >
            ↓ Download .pptx
          </a>
        </div>
      </div>
      <h2 className="mb-4 font-display text-[32px] font-medium leading-tight tracking-tight text-teal">
        {report.question}
      </h2>
      <p className="mb-9 max-w-prose text-base text-text-muted">{report.tldr}</p>

      {report.methods && (
        <div className="mb-9">
          <div className="section-label">
            Methods <span className="ml-0.5">›</span>
          </div>
          <p className="max-w-prose">
            {report.methods}{" "}
            <button
              type="button"
              onClick={() => setMethodsOpen(true)}
              className="text-teal font-medium underline-offset-2 hover:underline"
            >
              More on methods
            </button>
          </p>
        </div>
      )}

      <Modal
        open={methodsOpen}
        onClose={() => setMethodsOpen(false)}
        title="How this report was generated"
      >
        <MethodsDetail report={report} />
      </Modal>

      {report.report.map((b, i) => renderBlock(b, i, report.references))}

      {report.references && report.references.length > 0 && (
        <section className="mt-12">
          <div className="section-label">References</div>
          <ul className="space-y-3">
            {report.references.map((r) => (
              <li key={r.id} className="flex max-w-prose items-start justify-between gap-3 text-sm text-text">
                <div className="min-w-0 flex-1">
                  <span className="text-text-muted">
                    {r.authors.slice(0, 3).join(", ")}
                    {r.authors.length > 3 ? ` +${r.authors.length - 3}` : ""}
                  </span>{" "}
                  <span className="text-text-muted">({r.year}).</span>{" "}
                  <span className="font-medium">{r.title}.</span>{" "}
                  {r.journal && <span className="italic text-text-muted">{r.journal}</span>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <CiteCopyButtons paper={r} onCopied={(label) => show(`Copied ${label}`)} />
                  {savedIds.has(r.id) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal">
                      <Check size={10} /> Saved
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const added = addToLibrary([r], sourceLabel);
                        if (added > 0) show("Saved to library");
                        else show("Already in your library");
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text-muted hover:border-text hover:text-text"
                      title="Save this reference to your library"
                    >
                      <Book size={10} /> Save
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function MethodsDetail({ report }: { report: Report }) {
  const corpusLabel =
    report.corpus === "core" ? "CORE" : report.corpus === "s2" ? "Semantic Scholar" : "Default corpus";
  const gathered = report.gatheredSources?.length ?? report.searchResults?.length ?? 0;
  const included = report.references?.length ?? 0;
  const criteria = report.screening?.criteria ?? [];
  return (
    <div className="space-y-5 text-[14px] leading-relaxed text-text">
      <p className="text-text-muted">{report.methods}</p>

      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Pipeline
        </div>
        <ul className="space-y-1.5">
          <Row label="Corpus" value={corpusLabel} />
          <Row label="Sources gathered" value={String(gathered)} />
          <Row label="Sources included" value={String(included)} />
          {report.correctedQuery && (
            <Row label="Auto-corrected from" value={`“${report.question}”`} />
          )}
          <Row label="Generated" value={report.date} />
        </ul>
      </div>

      {criteria.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Inclusion criteria
          </div>
          <ul className="space-y-1.5">
            {criteria.map((c) => (
              <li key={c.id} className="rounded-md bg-surface-muted px-3 py-2 text-[13px]">
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[12px] text-text-muted">
        Each claim is tagged with the references it draws from. Where evidence is
        thin or preclinical, the report grades it explicitly in the Evidence
        strength block.
      </p>
    </div>
  );
}

// Per-reference copy buttons. Two tight pills (APA / BibTeX) that copy a
// formatted citation to the clipboard. We prefer the modern clipboard API
// and fall back to a hidden textarea + execCommand for older surfaces.
function CiteCopyButtons({
  paper,
  onCopied,
}: {
  paper: import("@/lib/types").Paper;
  onCopied: (label: string) => void;
}) {
  const copy = async (text: string, label: string) => {
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
      onCopied(label);
    } catch {
      onCopied(`Couldn't copy ${label}`);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => copy(formatApa(paper), "APA citation")}
        className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text-muted hover:border-text hover:text-text"
        title="Copy APA citation"
      >
        <FileText size={10} /> APA
      </button>
      <button
        type="button"
        onClick={() => copy(formatBibtex(paper), "BibTeX entry")}
        className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text-muted hover:border-text hover:text-text"
        title="Copy BibTeX entry"
      >
        <FileText size={10} /> BibTeX
      </button>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
