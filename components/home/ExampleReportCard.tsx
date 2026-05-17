import Link from "next/link";
import type { Report } from "@/lib/types";
import { ArrowRight, Check } from "@/components/ui/Icon";

const STATE_LABEL: Record<Report["initialView"], string> = {
  report: "Report ready",
  search: "Search results",
  gather: "Gathering sources",
  extraction: "Extraction results",
};

export function ExampleReportCard({ report }: { report: Report }) {
  const allDone =
    report.status.gather.done && report.status.screen.done && report.status.extract.done && report.status.generate.done;

  return (
    <Link
      href={`/report/${report.id}/${report.initialView}`}
      className="group flex flex-col rounded-[14px] bg-surface p-6 transition-colors hover:bg-surface-muted"
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
            (allDone ? "bg-text text-bg" : "bg-bg text-text-muted")
          }
        >
          {allDone && <Check size={10} />}
          {STATE_LABEL[report.initialView]}
        </span>
        <span className="text-xs text-text-faint">{report.date}</span>
      </div>
      <h3 className="mb-2 text-[18px] font-semibold leading-snug text-text">{report.question}</h3>
      <p className="mb-4 line-clamp-3 text-sm text-text-muted">{report.tldr}</p>

      <div className="mt-auto flex items-center justify-between text-xs text-text-muted">
        <div className="flex flex-wrap gap-3">
          {report.status.gather.sourcesFound != null && (
            <span>{report.status.gather.sourcesFound} sources</span>
          )}
          {report.status.screen.sourcesIncluded != null && (
            <span>{report.status.screen.sourcesIncluded} included</span>
          )}
          {report.status.extract.dataPointsExtracted != null && (
            <span>{report.status.extract.dataPointsExtracted} data points</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 font-medium text-text opacity-0 transition-opacity group-hover:opacity-100">
          Open <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
