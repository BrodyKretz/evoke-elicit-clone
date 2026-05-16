import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Tabs } from "@/components/layout/Tabs";
import { StatusSidebar } from "@/components/layout/StatusSidebar";
import { getReport } from "@/lib/data/reports";

export default function ReportLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const report = getReport(params.id);
  if (!report) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title={report.question} visibility={report.visibility} corpus={report.corpus} />
      <Tabs reportId={report.id} />
      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <section className="scroll-pane overflow-y-auto px-12 pb-16 pt-8">{children}</section>
        <StatusSidebar report={report} />
      </main>
    </div>
  );
}
