import { NextResponse } from "next/server";
import { listReports } from "@/lib/data/reports";
import { newRunId, saveRun } from "@/lib/store";
import { runPipeline } from "@/lib/pipeline";
import { isCorpusProvider } from "@/lib/corpus";
import type { SynthesisAction } from "@/lib/agents/synthesize";
import type { Report } from "@/lib/types";

const VALID_ACTIONS: SynthesisAction[] = ["table", "slides", "report"];
function isAction(x: unknown): x is SynthesisAction {
  return typeof x === "string" && (VALID_ACTIONS as string[]).includes(x);
}

export async function GET() {
  const reports = listReports().map((r) => ({
    id: r.id,
    question: r.question,
    tldr: r.tldr,
    date: r.date,
    visibility: r.visibility,
    status: r.status,
  }));
  return NextResponse.json({ reports });
}

// Create a new run. Returns immediately with the run id; the pipeline runs
// in the background and emits SSE events to /api/reports/[id]/stream.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    question?: string;
    corpus?: string;
    action?: string;
  };
  const cleaned = (body.question ?? "").trim();
  if (!cleaned) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  const corpus = isCorpusProvider(body.corpus) ? body.corpus : "s2";
  const action: SynthesisAction = isAction(body.action) ? body.action : "report";

  const id = newRunId();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const initial: Report = {
    id,
    question: cleaned,
    tldr: "Evoke is building and refining understanding of the research. The report will become available once all steps are complete.",
    date,
    visibility: "private",
    corpus,
    initialView: "gather",
    status: {
      gather: { done: false },
      screen: { done: false },
      extract: { done: false },
      generate: { done: false },
    },
  };
  saveRun(initial);

  // Intentionally NOT awaited — the pipeline owns its own error handling and
  // emits events to the run's bus. The Next.js Node runtime keeps the event
  // loop alive until the promise resolves.
  runPipeline(id, cleaned, initial, action).catch((err) => {
    console.error(`pipeline crashed for ${id}:`, err);
  });

  return NextResponse.json({ id, status: "started" });
}
