// Smoke test: run the synthesis agent against the prostate-cancer fixture's
// hand-written extraction data. Bypasses S2 + screening + extraction so we
// can verify the Opus side in isolation.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-synthesis.ts

import prostateCancer from "../lib/data/fixtures/prostate-cancer";
import { synthesizeReport } from "../lib/agents/synthesize";

async function main() {
  const extraction = prostateCancer.extraction;
  if (!extraction) {
    throw new Error("fixture has no extraction data");
  }

  console.log(`Synthesizing report for question:\n  "${prostateCancer.question}"\n`);
  console.log(`Input: ${extraction.rows.length} papers × ${extraction.columns.length} columns\n`);

  const start = Date.now();
  const { tldr, blocks } = await synthesizeReport(
    prostateCancer.question,
    extraction,
    null
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Done in ${elapsed}s\n`);
  console.log("TLDR:");
  console.log(`  ${tldr}\n`);

  console.log(`Body: ${blocks.length} blocks`);
  console.log("─".repeat(72));
  for (const b of blocks) {
    switch (b.kind) {
      case "sectionLabel":
        console.log(`\n[${b.text.toUpperCase()}]`);
        break;
      case "heading":
        console.log(`\n${"#".repeat(b.level)} ${b.text}`);
        break;
      case "paragraph":
        console.log(`\n${b.text}${b.cites ? ` (cites: ${b.cites})` : ""}`);
        break;
      case "table":
        console.log(`\nTable: ${b.columns.join(" | ")}`);
        console.log(`  ${"-".repeat(60)}`);
        for (const row of b.rows) {
          console.log(`  ${row.join(" | ")}`);
        }
        break;
      case "notes":
        console.log(`\nNotes: ${b.title ?? ""}`);
        for (const item of b.items) {
          console.log(`  • ${item.text}`);
          item.children?.forEach((c) => console.log(`     - ${c.text}`));
        }
        break;
    }
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
