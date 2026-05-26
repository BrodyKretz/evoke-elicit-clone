import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      controller.enqueue(encoder.encode(`: connected\n\n`));

      const sub = subscribe(params.id, (event) => {
        send(event);
        if (event.type === "complete" || event.type === "error") {
          sub.unsubscribe();
          controller.close();
        }
      });

      for (const e of sub.history) send(e);

      if (sub.closed) {
        sub.unsubscribe();
        controller.close();
      }
    },
    cancel() {},
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
