import { NextResponse } from "next/server";
import { newRunId, saveRun } from "@/lib/store";
import { runAgenticRag } from "@/lib/agents/agentic-rag";
import { isCorpusProvider } from "@/lib/corpus";
import type { Report } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    question?: string;
    corpus?: string;
  };
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  const corpus = isCorpusProvider(body.corpus) ? body.corpus : "s2";

  const id = newRunId();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const initial: Report = {
    id,
    question,
    tldr: "Agentic run in progress…",
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

  runAgenticRag(id, question, initial).catch((err) => {
    console.error(`agentic-rag crashed for ${id}:`, err);
  });

  return NextResponse.json({ id, status: "started" });
}
