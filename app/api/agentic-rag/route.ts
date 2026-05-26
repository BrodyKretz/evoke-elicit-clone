import { NextResponse } from "next/server";
import { newRunId, saveRun } from "@/lib/store";
import { runAgenticRag } from "@/lib/agents/agentic-rag";
import { isCorpusProvider } from "@/lib/corpus";
import { runWithKeys } from "@/lib/request-context";
import type { Report } from "@/lib/types";

export async function POST(req: Request) {
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

  // Wrap the fire-and-forget so the ALS context propagates into the
  // async pipeline chain — without this, deep callees see an empty store.
  runWithKeys({ anthropicKey, s2Key }, () => {
    runAgenticRag(id, question, initial).catch((err) => {
      console.error(`agentic-rag crashed for ${id}:`, err);
    });
  });

  return NextResponse.json({ id, status: "started" });
}
