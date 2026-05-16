import { notFound } from "next/navigation";
import { getReport } from "@/lib/data/reports";
import { ReportView } from "@/components/report/ReportView";

export default function ReportTab({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();
  return <ReportView report={report} />;
}
