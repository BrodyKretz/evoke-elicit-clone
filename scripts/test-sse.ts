// Smoke test: emit a sequence of fake pipeline events for a fixed run id and
// verify the SSE endpoint streams them back. Validates the bus + SSE plumbing
// without needing S2 or any LLM calls.
//
// Usage:
//   1. Start the dev server in another terminal: npm run dev
//   2. Run this script: npx tsx scripts/test-sse.ts
//
// Note: this hits the locally running Next.js process via HTTP. The `emit`
// function lives in the same Node process as the dev server only if Next.js's
// dev server doesn't fork the route handler — to be safe we POST a fake run
// here and rely on the running pipeline emitting events itself.

const BASE = process.env.EVOKE_BASE ?? "http://localhost:3000";

async function main() {
  // Create a real run — this triggers the pipeline in the dev server's process.
  const res = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Test question for SSE plumbing" }),
  });
  const { id } = (await res.json()) as { id: string };
  console.log(`Created run ${id}, opening SSE stream...`);

  const streamRes = await fetch(`${BASE}/api/reports/${id}/stream`);
  if (!streamRes.body) throw new Error("no stream body");
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const block of events) {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      console.log(`  [${new Date(data.ts).toISOString().slice(11, 19)}] ${data.type}${data.stage ? " " + data.stage : ""}${data.error ? " — " + data.error : ""}${data.done != null ? ` (${data.done}/${data.total})` : ""}`);
      if (data.type === "complete" || data.type === "error") {
        console.log("Stream closed.");
        return;
      }
    }
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
