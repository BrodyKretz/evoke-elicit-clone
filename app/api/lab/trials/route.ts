import { NextResponse } from "next/server";
import { searchTrials, type TrialStatus } from "@/lib/trials";

// Lab > Trials backing route. Thin wrapper around ClinicalTrials.gov v2.

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "COMPLETED",
  "TERMINATED",
  "WITHDRAWN",
  "NOT_YET_RECRUITING",
  "ENROLLING_BY_INVITATION",
  "SUSPENDED",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const statusParam = url.searchParams.get("status");

  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  let status: TrialStatus | undefined;
  if (statusParam && ALLOWED_STATUSES.has(statusParam)) {
    status = statusParam as TrialStatus;
  }

  try {
    const { trials, totalCount } = await searchTrials(q, { limit, status });
    return NextResponse.json({ trials, totalCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "trials search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
