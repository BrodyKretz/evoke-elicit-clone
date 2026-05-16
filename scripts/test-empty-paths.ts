// Unit-style test for the pipeline's "soft-empty" finalization paths.
//
// Verifies that calling the pipeline with zero screenable papers (which is
// the same code path as zero-gathered-papers, since both hit finalizeEmpty)
// produces a graceful `complete` event and a friendly tldr on the persisted
// report — NOT a hard `error` event from the screen stage.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-empty-paths.ts

import { runFromScreening } from "../lib/pipeline";
import { subscribe } from "../lib/events";
import { getReport } from "../lib/data/reports";
import { saveRun, newRunId } from "../lib/store";
import type { Report } from "../lib/types";

function buildInitialReport(id: string, corpus: "s2" | "core"): Report {
  return {
    id,
    question: "Test query that returns no usable papers",
    tldr: "Initial placeholder.",
    date: "2026-05-13",
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
}

async function runCase(label: string, corpus: "s2" | "core") {
  console.log(`──── ${label} (corpus=${corpus}) ────`);
  const id = newRunId();
  const initial = buildInitialReport(id, corpus);
  saveRun(initial);

  // Collect events.
  const seen: { type: string; stage?: string; error?: string }[] = [];
  const sub = subscribe(id, (e) => {
    seen.push({ type: e.type, stage: "stage" in e ? e.stage : undefined, error: "error" in e ? e.error : undefined });
  });

  // Drive the pipeline from the screening stage with an empty paper list.
  // The screen-zero path is the converging case for both gather-zero and
  // no-abstracts scenarios (same finalizeEmpty helper).
  await runFromScreening(id, initial.question, initial, [], { id: "c1", text: "test criterion" });

  sub.unsubscribe();

  const eventTypes = seen.map((e) => `${e.type}${e.stage ? `:${e.stage}` : ""}`).join(" → ");
  console.log(`Events: ${eventTypes}`);

  const saved = getReport(id);
  if (!saved) {
    console.log("✗ Run not persisted");
    return false;
  }
  console.log(`Final tldr: ${saved.tldr}`);

  // Assertions
  const sawError = seen.some((e) => e.type === "error" || e.type === "stage.error");
  const sawComplete = seen.some((e) => e.type === "complete");
  const friendlyTldr = /no.*abstract|no sources found/i.test(saved.tldr);

  let pass = true;
  if (sawError) {
    console.log("✗ Unexpected error event emitted");
    pass = false;
  } else {
    console.log("✓ No error event");
  }
  if (!sawComplete) {
    console.log("✗ Missing complete event");
    pass = false;
  } else {
    console.log("✓ Complete event present");
  }
  if (!friendlyTldr) {
    console.log("✗ Final tldr doesn't look like an empty-state message");
    pass = false;
  } else {
    console.log("✓ Friendly empty-state tldr");
  }
  return pass;
}

async function main() {
  console.log("Testing soft-empty pipeline finalization\n");
  const results: boolean[] = [];
  results.push(await runCase("Empty papers via runFromScreening", "s2"));
  console.log();
  results.push(await runCase("Empty papers via runFromScreening", "core"));
  console.log();

  const passed = results.filter(Boolean).length;
  console.log(`========================================`);
  console.log(`${passed}/${results.length} cases passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
