import { Suspense } from "react";
import { ResearchShell } from "@/components/research-agent/ResearchShell";
import { LabShell } from "@/components/lab/LabShell";
import { FindPapers } from "@/components/lab/FindPapers";

// /lab/find — empty-state landing shows the shared light shell with mode
// "find-papers". Once a query is submitted (?q=...), fall back to the
// existing FindPapers component so the search runs and results render.
//
// The existing FindPapers component is still dark-themed — restyling it to
// match the light shell is a separate follow-up.

export default function FindPapersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  if (q) return <LabShell mode="find-papers"><Suspense fallback={null}><FindPapers /></Suspense></LabShell>;
  return <ResearchShell mode="find-papers" />;
}
