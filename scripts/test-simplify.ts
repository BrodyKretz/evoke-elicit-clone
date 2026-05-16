// Smoke test for the DumDum simplify path. Streams a verbose research-style
// answer through simplifyText and prints the output.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-simplify.ts

import { simplifyText } from "../lib/agents/chat";

const SAMPLE = `Based on the extraction table provided, among studies with reported sample sizes, Bare et al., 1998 had the largest reported sample size at N=38, using video EEG to identify atypical absence seizures. Deering et al., 2024 reported N=33 using EEG slow spike-wave (SSW) patterns as an early biomarker for seizure-free periods. Kobayashi et al., 2009 had N=20 examining EEG gamma rhythms in tonic seizures. Dalic et al., 2022a (Paper [1]) reported N=17 evaluating generalized paroxysmal fast activity (GPFA) as a treatment-response biomarker in deep brain stimulation. Several studies in the table did not report sample size in the abstract (Zhou et al., Bullinger et al., Yagi). Additionally, the systematic reviews in the run (Paper [3], Nizami et al., 2024; Paper [9], Alanazi et al., 2022) likely aggregate far more patients than any single primary study, but their pooled N isn't given in the materials available.`;

async function main() {
  console.log("Original (length: " + SAMPLE.length + " chars):\n");
  console.log(SAMPLE);
  console.log("\n────────────────────────────────────────");
  console.log("DumDum version:\n");

  const start = Date.now();
  let acc = "";
  await simplifyText(SAMPLE, (chunk) => {
    process.stdout.write(chunk);
    acc += chunk;
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log("\n────────────────────────────────────────");
  console.log(`Length: ${acc.length} chars (${((acc.length / SAMPLE.length) * 100).toFixed(0)}% of original) in ${elapsed}s`);

  // Sanity checks
  const keptCitation = /paper\s*\[\d+\]/i.test(acc);
  console.log(keptCitation ? "✓ Preserved a Paper [N] citation" : "✗ Lost the Paper [N] citation");

  const isShorter = acc.length < SAMPLE.length;
  console.log(isShorter ? "✓ Shorter than original" : "✗ Not shorter than original");
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
