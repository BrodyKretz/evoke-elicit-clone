import { NextResponse } from "next/server";
import { getReport } from "@/lib/data/reports";
import { saveRun } from "@/lib/store";
import { runFromScreening } from "@/lib/pipeline";
import { runWithKeys } from "@/lib/request-context";

// Re-run from screening for an existing run with a (possibly user-edited)
// criterion. Reuses the run's already-gathered papers — no S2 call.
// Cascades: screen → extract → synthesize, all async, events stream over
// the existing SSE bus at /api/reports/[id]/stream.

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const anthropicKey = req.headers.get("x-anthropic-api-key")?.trim();
  if (!anthropicKey) {
    return NextResponse.json(
      {
        error:
          "Anthropic API key required. Click the key icon in the top bar to add yours.",
        code: "MISSING_ANTHROPIC_KEY",
      },
      { status: 400 }
    );
  }
  const s2Key = req.headers.get("x-s2-api-key")?.trim() || undefined;

  const report = getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Fixtures are immutable — don't allow rescreening them.
  if (report.id.length > 10 || !/^[0-9a-f]+$/i.test(report.id)) {
    return NextResponse.json(
      { error: "rescreening seeded fixtures is not supported" },
      { status: 400 }
    );
  }

  const { criterion: rawCriterion } = (await req.json().catch(() => ({}))) as {
    criterion?: string;
  };
  const criterionText = (rawCriterion ?? "").trim();
  if (!criterionText) {
    return NextResponse.json({ error: "criterion required" }, { status: 400 });
  }

  const papers = (report.gatheredSources ?? report.searchResults ?? []).filter(
    (p) => p.abstract
  );
  if (papers.length === 0) {
    return NextResponse.json({ error: "no papers to screen" }, { status: 400 });
  }

  // Reset downstream state so the in-flight UI knows the cascade is starting.
  // Gather stays done; everything below it resets.
  const reset = {
    ...report,
    screening: undefined,
    extraction: undefined,
    report: undefined,
    references: undefined,
    initialView: "gather" as const,
    status: {
      ...report.status,
      screen: { done: false },
      extract: { done: false },
      generate: { done: false },
    },
  };
  saveRun(reset);

  const criterion = { id: "c1", text: criterionText };
  // Fire-and-forget background cascade — emits to the SSE bus, persists final
  // state, returns no value to this route. runWithKeys propagates the per-
  // request key context into the async cascade.
  runWithKeys({ anthropicKey, s2Key }, () => {
    runFromScreening(params.id, report.question, reset, papers, criterion).catch(
      (err) => console.error(`rescreen cascade crashed for ${params.id}:`, err)
    );
  });

  return NextResponse.json({ id: params.id, status: "started" });
}
