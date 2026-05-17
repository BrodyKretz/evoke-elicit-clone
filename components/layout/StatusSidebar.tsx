"use client";

import { useToast } from "@/components/ui/Toast";
import { Check, Download, ExternalLink } from "@/components/ui/Icon";
import type { PipelineStatus, Report } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { reportToMarkdown } from "@/lib/utils/export-markdown";
import { ChatPanel } from "./ChatPanel";

// Vertical stepper status panel matching the Elicit reference. Light theme,
// rounded card, four stages with state-aware icons and per-step Details
// affordances. Generate-report row promotes to the primary export action
// (.pptx download + .md fallback) once the run completes.

type Step = {
  key: "gather" | "screen" | "extract" | "generate";
  name: string;
  subtitle: string; // sub-text shown under the step name (e.g. "50 sources found")
  done: boolean;
};

function steps(s: PipelineStatus): Step[] {
  return [
    {
      key: "gather",
      name: "Gather sources",
      subtitle:
        s.gather.sourcesFound != null
          ? `${s.gather.sourcesFound} sources found`
          : "Searching the corpus",
      done: s.gather.done,
    },
    {
      key: "screen",
      name: "Screen sources",
      subtitle:
        s.screen.sourcesIncluded != null
          ? `${s.screen.sourcesIncluded} sources included`
          : "Filtering studies based on inclusion criteria",
      done: s.screen.done,
    },
    {
      key: "extract",
      name: "Extract data",
      subtitle:
        s.extract.dataPointsExtracted != null
          ? `${s.extract.dataPointsExtracted} data points extracted`
          : "Capturing key metrics and findings from every paper",
      done: s.extract.done,
    },
    {
      key: "generate",
      name: "Generate report",
      subtitle: s.generate.done ? "Report ready" : "Summarizing findings",
      done: s.generate.done,
    },
  ];
}

export function StatusSidebar({ report }: { report: Report }) {
  const { show } = useToast();
  const status = report.status;
  const items = steps(status);
  // Active = first incomplete step (or last one once everything's done).
  const activeIdx = items.findIndex((s) => !s.done);
  const focusIdx = activeIdx === -1 ? items.length - 1 : activeIdx;

  const downloadMarkdown = () => {
    const md = reportToMarkdown(report);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = report.question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    a.href = url;
    a.download = `${slug || "evoke-report"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show("Markdown downloaded");
  };

  return (
    <aside className="scroll-pane flex flex-col overflow-y-auto border-l border-border bg-bg p-5">
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3 text-[13px] font-semibold text-text">
          <span>Report</span>
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            Status
          </div>
          <ol className="flex flex-col">
            {items.map((item, i) => {
              const isFocus = i === focusIdx;
              const isLast = i === items.length - 1;
              return (
                <li key={item.key} className="relative">
                  {/* connector line between rows */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[10px] top-7 -ml-px h-[calc(100%-1rem)] w-px",
                        item.done ? "bg-teal" : "bg-border"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "relative flex items-start justify-between gap-2 rounded-lg py-2 pr-1",
                      isFocus ? "bg-teal-light -mx-2 px-2" : ""
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-[1.5px]",
                          item.done
                            ? "border-teal bg-teal text-white"
                            : isFocus
                            ? "border-teal bg-surface text-teal-bright"
                            : "border-border-strong bg-surface text-transparent"
                        )}
                      >
                        {item.done && <Check size={11} />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium leading-snug text-text">
                          {item.name}
                        </div>
                        <div className="text-[12px] leading-snug text-text-muted">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {item.done && (
                        <button
                          onClick={() => show(`${item.name} details`)}
                          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-teal-bright hover:bg-teal-light"
                        >
                          Details
                          <ExternalLink size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Export row — only meaningful once the report is generated */}
        {status.generate.done && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <a
              href={`/api/reports/${report.id}/export/pdf`}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-teal-hover"
              title="Download this report as a PDF"
            >
              <Download size={11} />
              .pdf
            </a>
            <a
              href={`/api/reports/${report.id}/export/pptx`}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal bg-surface px-2.5 py-1.5 text-[12px] font-medium text-teal-bright hover:bg-teal-light"
              title="Download this report as a PowerPoint (.pptx) deck"
            >
              <Download size={11} />
              .pptx
            </a>
            <button
              onClick={downloadMarkdown}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-text hover:bg-surface-muted"
              title="Download as Markdown"
            >
              <Download size={11} />
              .md
            </button>
          </div>
        )}
      </div>

      <ChatPanel report={report} />
    </aside>
  );
}
