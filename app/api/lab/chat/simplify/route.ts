import { simplifyText } from "@/lib/agents/chat";

// DumDum endpoint for the Lab > Chat tool. Same behavior as
// /api/reports/[id]/chat/simplify but doesn't require a Report row.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
