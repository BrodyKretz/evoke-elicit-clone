// End-to-end test for the soft-empty fix. POSTs a query that is expected to
// return zero sources from the chosen corpus, streams the SSE pipeline events,
// and verifies graceful finalization.
//
// Usage:
//   1. dev server must be running (npm run dev). Override BASE if not on :3001.
//   2. set -a && source .env.local && set +a && npx tsx scripts/test-empty-e2e.ts

const BASE = process.env.EVOKE_BASE ?? "http://localhost:3001";

type Outcome = {
  events: { type: string; stage?: string; data?: unknown; error?: string }[];
  fatalError?: string;
  sawComplete: boolean;
  finalReport?: {
    tldr: string;
    status?: { gather?: { done?: boolean; sourcesFound?: number } };
  };
};

async function runQuery(question: string, corpus: "s2" | "core"): Promise<Outcome> {
  const create = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, corpus }),
  });
  if (!create.ok) throw new Error(`create failed: ${create.status} ${await create.text()}`);
  const { id } = (await create.json()) as { id: string };

  const streamRes = await fetch(`${BASE}/api/reports/${id}/stream`);
  if (!streamRes.body) throw new Error("no stream body");
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const events: Outcome["events"] = [];
  let fatalError: string | undefined;
  let sawComplete = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let data: { type: string; stage?: string; data?: unknown; error?: string };
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      events.push({ type: data.type, stage: data.stage, data: data.data, error: data.error });
      if (data.type === "complete") {
        sawComplete = true;
        break;
      }
      if (data.type === "error") {
        fatalError = data.error;
        break;
      }
    }
    if (sawComplete || fatalError) break;
  }

  // Fetch the persisted run to check tldr/status.
  const get = await fetch(`${BASE}/api/reports`);
  let finalReport: Outcome["finalReport"];
  if (get.ok) {
    const { reports } = (await get.json()) as {
      reports: { id: string; tldr: string; status?: Outcome["finalReport"]["status"] }[];
    };
    const r = reports.find((x) => x.id === id);
    if (r) finalReport = { tldr: r.tldr, status: r.status };
  }

  return { events, fatalError, sawComplete, finalReport };
}

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✓" : "✗"} ${label} — ${detail}`);
  return ok;
}

async function main() {
  console.log(`E2E empty-finalize tests against ${BASE}\n`);

  // Case 1: nonsense query against CORE. CORE accepts our API key, so it
  // should return 0 hits (not 429) and let us exercise the empty-finalize
  // path on a real corpus.
  console.log("──── Case 1: nonsense query, corpus=core ────");
  const c1 = await runQuery("zxqwvbnmplkjhgfdsa-totally-not-a-real-research-topic", "core");
  console.log(`  Events seen: ${c1.events.map((e) => `${e.type}${e.stage ? `:${e.stage}` : ""}`).join(" → ")}`);
  if (c1.finalReport) console.log(`  Final tldr: ${c1.finalReport.tldr}`);
  const c1Pass = [
    check("Case 1", !c1.fatalError, c1.fatalError ? `unexpected error: ${c1.fatalError}` : "no error event"),
    check("Case 1", c1.sawComplete, c1.sawComplete ? "complete event seen" : "missing complete"),
    check(
      "Case 1",
      /no sources found|none had abstracts/i.test(c1.finalReport?.tldr ?? ""),
      `tldr looks like empty-state`
    ),
  ].every(Boolean);

  // Case 2: the user's actual query — "how do you treat tourretts" against
  // S2. Without an S2 API key this either returns 0 (the bug case) or 429
  // (a different existing-error path). Both should not produce the original
  // "screen: no papers with abstracts to screen" crash.
  console.log("\n──── Case 2: user's reported query, corpus=s2 ────");
  const c2 = await runQuery("how do you treat tourretts", "s2");
  console.log(`  Events seen: ${c2.events.map((e) => `${e.type}${e.stage ? `:${e.stage}` : ""}`).join(" → ")}`);
  if (c2.finalReport) console.log(`  Final tldr: ${c2.finalReport.tldr.slice(0, 160)}${c2.finalReport.tldr.length > 160 ? "…" : ""}`);
  // For case 2 we don't care if it succeeded or returned empty — we just want
  // no hard crash from the screen stage on an unintended empty.
  const c2Pass = check(
    "Case 2",
    !c2.fatalError || !/no papers with abstracts to screen/i.test(c2.fatalError),
    c2.fatalError
      ? c2.fatalError.startsWith("gather:") && /429/.test(c2.fatalError)
        ? "S2 rate-limited (existing path, not the bug)"
        : `unexpected: ${c2.fatalError}`
      : "completed without screen-stage crash"
  );

  console.log("\n========================================");
  const total = (c1Pass ? 1 : 0) + (c2Pass ? 1 : 0);
  console.log(`${total}/2 cases passed`);
  if (total !== 2) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
