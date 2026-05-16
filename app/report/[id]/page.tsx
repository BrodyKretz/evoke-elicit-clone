import { redirect, notFound } from "next/navigation";
import { getReport } from "@/lib/data/reports";

export default function ReportIndex({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();
  redirect(`/report/${report.id}/${report.initialView}`);
}
