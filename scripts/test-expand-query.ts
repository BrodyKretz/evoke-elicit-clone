// Smoke test for the parallel-search query expander. Confirms that obvious
// research questions get expanded into useful adjacent search phrasings.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-expand-query.ts

import { expandQuery } from "../lib/agents/expand-query";

const CASES = [
  "What are the most effective molecular targets for treatment of metastatic neuroendocrine prostate cancer in patients who have failed standard androgen deprivation therapy?",
  "How does intermittent fasting affect insulin sensitivity?",
  "Mechanisms linking chronic sleep loss to immune dysfunction in adults",
];

async function main() {
  console.log("Query expander smoke test\n");
  let pass = 0;
  for (const q of CASES) {
    console.log(`────────────────────────────────────────`);
    console.log(`Original: ${q}`);
    const t0 = Date.now();
    const { variants } = await expandQuery(q);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`Variants (${elapsed}s):`);
    variants.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));

    const distinct = variants.every((v) => v.toLowerCase() !== q.toLowerCase());
    const reasonable = variants.length >= 1 && variants.length <= 3;
    if (distinct && reasonable) {
      console.log(`✓ ${variants.length} variants, all distinct from the original`);
      pass++;
    } else {
      console.log(`✗ unexpected — variants=${variants.length}, distinct=${distinct}`);
    }
  }
  console.log(`\n${pass}/${CASES.length} cases passed`);
  if (pass !== CASES.length) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
