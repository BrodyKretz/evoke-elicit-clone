// Smoke test: run the screening agent against the prostate-cancer fixture
// (which already has 4 papers with abstracts). Bypasses Semantic Scholar
// entirely so we can verify the Anthropic side without S2 rate limits.
//
// Usage: node --env-file=.env.local --import tsx scripts/test-screening.ts

import prostateCancer from "../lib/data/fixtures/prostate-cancer";
import { generateCriterion, screenPapers } from "../lib/agents/screen";

async function main() {
  const papers = (prostateCancer.gatheredSources ?? []).filter((p) => p.abstract);
  console.log(`Screening ${papers.length} papers for question:\n  "${prostateCancer.question}"\n`);

  console.log("Generating criterion...");
  const criterion = await generateCriterion(prostateCancer.question);
  console.log(`  → ${criterion.text}\n`);

  console.log("Screening papers...");
  const start = Date.now();
  const results = await screenPapers(papers, criterion, prostateCancer.question);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  → ${results.length} results in ${elapsed}s\n`);

  for (const r of results) {
    const paper = papers.find((p) => p.id === r.paperId);
    console.log(`[${r.decision.toUpperCase().padEnd(7)}] ${paper?.title.slice(0, 70)}`);
    console.log(`           ${r.rationale}\n`);
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
