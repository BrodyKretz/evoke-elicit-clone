// Smoke test for the silent query normalizer. Verifies that:
//   - Obvious typos get corrected (e.g. "tourretts" → "Tourette syndrome")
//   - Correct queries return null (no correction)
//   - Valid domain acronyms aren't "corrected" away (e.g. "ALS")
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-normalize.ts

import { suggestCorrectedQuery } from "../lib/agents/normalize";

type Case = {
  query: string;
  expect: "corrected" | "unchanged";
  notes: string;
};

const cases: Case[] = [
  {
    query: "how do you treat tourretts",
    expect: "corrected",
    notes: "Tourette syndrome misspelled — should be corrected.",
  },
  {
    query: "alzheimrs disease early biomarkers",
    expect: "corrected",
    notes: "Alzheimer's misspelled — should be corrected.",
  },
  {
    query: "how do you treat ALS",
    expect: "unchanged",
    notes: "ALS is a valid acronym. Should NOT be expanded or rewritten.",
  },
  {
    query: "molecular targets for prostate cancer",
    expect: "unchanged",
    notes: "No typos. Should return null.",
  },
  {
    query: "CRISPR-Cas9 efficacy in sickle cell disease",
    expect: "unchanged",
    notes: "Domain term that looks unusual but is correct. Should not be 'fixed'.",
  },
];

async function main() {
  console.log("Query normalizer smoke test\n");
  const results: { case: Case; correction: string | null; pass: boolean }[] = [];
  for (const c of cases) {
    console.log(`────────────────────────────────────────`);
    console.log(`Query: "${c.query}"`);
    console.log(`Expect: ${c.expect} — ${c.notes}`);
    const start = Date.now();
    const correction = await suggestCorrectedQuery(c.query);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Result: ${correction == null ? "null (unchanged)" : `"${correction}"`} in ${elapsed}s`);

    let pass: boolean;
    if (c.expect === "corrected") {
      pass = correction != null && correction.toLowerCase() !== c.query.toLowerCase();
    } else {
      pass = correction == null;
    }
    console.log(pass ? `✓ pass` : `✗ fail`);
    results.push({ case: c, correction, pass });
  }

  console.log("\n========================================");
  const passed = results.filter((r) => r.pass).length;
  console.log(`${passed}/${results.length} cases passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
