import { ResearchShell } from "@/components/research-agent/ResearchShell";

// /lab/report — uses the shared shell with Report mode (example chips + Source
// dropdown). Surfaces the same Research-agent flow under a different framing.

export default function ReportPage() {
  return <ResearchShell mode="report" />;
}
