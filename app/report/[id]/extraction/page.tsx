import { notFound } from "next/navigation";
import { getReport } from "@/lib/data/reports";
import { ExtractionView } from "@/components/extraction/ExtractionView";

export default function ExtractionTab({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();
  return <ExtractionView report={report} />;
}
