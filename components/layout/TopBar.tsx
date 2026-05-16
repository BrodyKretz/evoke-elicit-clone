"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Bell, ChevronLeft, Sidebar } from "@/components/ui/Icon";

type Props = {
  title: string;
  visibility?: "public" | "private";
  corpus?: "s2" | "core";
  progressDots?: number;
};

const CORPUS_LABEL: Record<NonNullable<Props["corpus"]>, string> = {
  s2: "Semantic Scholar",
  core: "CORE",
};

export function TopBar({ title, visibility = "public", corpus, progressDots = 6 }: Props) {
  const router = useRouter();
  const { show } = useToast();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-bg px-6 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => router.back()}
          className="grid h-8 w-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface"
          aria-label="Back"
        >
          <ChevronLeft size={16} />
        </button>
        {corpus && (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted"
            title={`This run used ${CORPUS_LABEL[corpus]} as its corpus`}
          >
            <span className="text-[9px] uppercase tracking-wider text-text-faint">Corpus</span>
            <span className="text-text">{CORPUS_LABEL[corpus]}</span>
          </span>
        )}
        <h1 className="truncate text-sm font-medium text-text">
          {title}
          {visibility ? ` (${visibility})` : null}
        </h1>
      </div>

      <div className="mx-4 flex items-center gap-1.5">
        {Array.from({ length: progressDots }).map((_, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-teal" />
        ))}
        <span className="ml-2 text-[13px] text-text-muted">
          <strong className="font-semibold text-text">Research report</strong> &nbsp;View only
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => show("Alert created")}>
          <Bell size={14} /> Create alert
        </button>
        <button className="btn btn-icon" onClick={() => show("Sidebar toggled")} aria-label="Toggle sidebar">
          <Sidebar size={14} />
        </button>
      </div>
    </header>
  );
}
