import { notFound } from "next/navigation";
import { getRun } from "@/lib/store";
import { TraceView } from "@/components/agentic-rag/TraceView";

export const dynamic = "force-dynamic";

export default function AgenticRunPage({ params }: { params: { id: string } }) {
  const report = getRun(params.id);
  if (!report) notFound();
  return <TraceView id={params.id} question={report.question} />;
}
