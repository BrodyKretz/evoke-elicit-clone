import { getReport } from "@/lib/data/reports";
import { chat, type ChatMessage } from "@/lib/agents/chat";

// Streaming chat endpoint scoped to one report.
// Request body: { messages: ChatMessage[], userMessage: string }
// Response: text/event-stream of `{type: "delta" | "done", text?}` events.

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, userMessage } = (await req.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
    userMessage?: string;
  };
  const userText = (userMessage ?? "").trim();
  if (!userText) {
    return new Response(JSON.stringify({ error: "userMessage required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = (Array.isArray(messages) ? messages : []).filter(
    (m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        await chat(report, history, userText, (text) =>
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
