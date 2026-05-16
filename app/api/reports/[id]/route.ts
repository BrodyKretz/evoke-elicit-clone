import { NextResponse } from "next/server";
import { getReport } from "@/lib/data/reports";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ report });
}
