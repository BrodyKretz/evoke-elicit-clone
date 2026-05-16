import { notFound } from "next/navigation";
import { getReport } from "@/lib/data/reports";
import { SearchView } from "@/components/search/SearchView";

export default function SearchTab({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();
  return <SearchView report={report} />;
}
