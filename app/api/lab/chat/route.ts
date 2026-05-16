import { chat, type ChatMessage } from "@/lib/agents/chat";
import type { Paper, Report } from "@/lib/types";

// Lab > Chat with papers endpoint. Like /api/reports/[id]/chat but operates on
// an arbitrary paper set passed in the request — no Report row needs to
// exist. Streams the assistant response as SSE.
// Body: { papers: Paper[], messages: ChatMessage[], userMessage: string,
//         topic?: string }

export const dynamic = "force-dynamic";

function buildSyntheticReport(papers: Paper[], topic: string): Report {
  return {
    id: "lab-chat",
    question: topic || "Standalone discussion of selected papers",
    tldr: `Ad-hoc chat scoped to ${papers.length} user-selected paper${papers.length === 1 ? "" : "s"}.`,
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    visibility: "private",
    initialView: "report",
    status: {
      gather: { done: true, sourcesFound: papers.length },
      screen: { done: false },
      extract: { done: false },
      generate: { done: false },
    },
    references: papers,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    papers?: Paper[];
    messages?: ChatMessage[];
    userMessage?: string;
    topic?: string;
  };

  const papers = Array.isArray(body.papers) ? body.papers : [];
  if (papers.length === 0) {
    return new Response(JSON.stringify({ error: "no papers selected" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userText = (body.userMessage ?? "").trim();
  if (!userText) {
    return new Response(JSON.stringify({ error: "userMessage required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );

  const synthetic = buildSyntheticReport(papers, (body.topic ?? "").trim());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        await chat(synthetic, history, userText, (text) =>
          send({ type: "delta", text })
        );
        send({ type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "chat failed";
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
