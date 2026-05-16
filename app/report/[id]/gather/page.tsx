import { notFound } from "next/navigation";
import { getReport } from "@/lib/data/reports";
import { GatherView } from "@/components/gather/GatherView";

export default function GatherTab({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();
  return <GatherView report={report} />;
}
