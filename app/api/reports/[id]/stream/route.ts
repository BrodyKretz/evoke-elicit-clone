import { subscribe } from "@/lib/events";

// SSE endpoint for live pipeline progress.
// Replays history first so late subscribers don't miss earlier events,
// then tails the bus until a `complete` or `error` event closes it.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Flush headers immediately so the client sees the SSE connection open.
      // Without this, Next.js may buffer until the first data event, and
      // clients with short header-timeout windows (Node fetch: 30s) bail.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const sub = subscribe(params.id, (event) => {
        send(event);
        if (event.type === "complete" || event.type === "error") {
          sub.unsubscribe();
          controller.close();
        }
      });

      // Replay history (events already in the buffer before we subscribed).
      for (const e of sub.history) send(e);

      // If the run already finished, close after replaying.
      if (sub.closed) {
        sub.unsubscribe();
        controller.close();
      }
    },
    cancel() {
      // Client closed the connection — nothing to do; subscribe's listener
      // is auto-cleaned on `complete`/`error`.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering if behind nginx
    },
  });
}
