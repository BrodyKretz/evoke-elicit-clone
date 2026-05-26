import { NextResponse } from "next/server";
import { getRun } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = getRun(params.id);
  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ report });
}
