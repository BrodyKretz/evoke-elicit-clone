// Smoke test: run the extraction agent against the prostate-cancer fixture
// papers. Bypasses Semantic Scholar + screening so we can verify the Anthropic
// extraction side in isolation.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-extraction.ts

import prostateCancer from "../lib/data/fixtures/prostate-cancer";
import { extractPapers } from "../lib/agents/extract";

async function main() {
  const papers = (prostateCancer.gatheredSources ?? []).filter((p) => p.abstract);
  console.log(`Extracting from ${papers.length} papers for question:\n  "${prostateCancer.question}"\n`);

  const start = Date.now();
  const { columns, rows } = await extractPapers(papers, prostateCancer.question);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Generated ${columns.length} columns in ${elapsed}s:`);
  columns.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log();

  for (const row of rows) {
    console.log(`━━ ${row.paper.title.slice(0, 70)}`);
    columns.forEach((col, i) => {
      const cell = row.cells[i] ?? "—";
      const short = cell.length > 200 ? cell.slice(0, 197) + "..." : cell;
      console.log(`  ${col}:`);
      short.split("\n").forEach((line) => console.log(`      ${line}`));
    });
    console.log();
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
