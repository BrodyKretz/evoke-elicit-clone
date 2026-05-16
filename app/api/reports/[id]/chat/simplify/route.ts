import { getReport } from "@/lib/data/reports";
import { simplifyText } from "@/lib/agents/chat";

// Streaming "DumDum" endpoint: takes a verbose assistant response and rewrites
// it for a high-schooler. Same SSE event shape as the main chat route.
// Request body: { text: string }
// Response: text/event-stream of `{type: "delta" | "done" | "error", text?}` events.

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const source = (text ?? "").trim();
  if (!source) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        await simplifyText(source, (chunk) => send({ type: "delta", text: chunk }));
        send({ type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "simplify failed";
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
