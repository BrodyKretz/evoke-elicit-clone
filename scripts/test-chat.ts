// Smoke test for the chat agent against the Lennox-Gastaut fixture.
// Covers three scopes:
//   1. In-run question — should answer from the papers and cite.
//   2. Topic-relevant background question not in the papers — should answer
//      with the "General background (not from your papers):" label.
//   3. Fully off-topic question — should be politely declined.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-chat.ts

import lennoxGastaut from "../lib/data/fixtures/lennox-gastaut";
import { chat } from "../lib/agents/chat";

type Case = {
  q: string;
  kind: "in-run" | "background" | "off-topic";
};

async function main() {
  console.log(`Chatting about: "${lennoxGastaut.question}"\n`);

  const cases: Case[] = [
    { q: "Which paper had the largest sample size and what did it find?", kind: "in-run" },
    { q: "What is Lennox-Gastaut syndrome?", kind: "background" },
    { q: "What's the weather like today?", kind: "off-topic" },
  ];

  for (const { q, kind } of cases) {
    console.log(`────────────────────────────────────────`);
    console.log(`Q: ${q}  [${kind}]`);
    process.stdout.write("A: ");
    const full = await chat(lennoxGastaut, [], q, (chunk) =>
      process.stdout.write(chunk)
    );
    console.log("\n");

    const lower = full.toLowerCase();
    if (kind === "off-topic") {
      const declined =
        lower.includes("can only") ||
        lower.includes("scoped") ||
        lower.includes("research results") ||
        lower.includes("related to your");
      console.log(declined ? "✓ Correctly declined off-topic" : "✗ Did not decline off-topic");
    } else if (kind === "background") {
      const labeled = full.includes("General background (not from your papers):");
      console.log(labeled ? "✓ Used the general-background label" : "✗ Missing general-background label");
    } else {
      const citesPaper = /paper\s*\[\d+\]/i.test(full);
      console.log(citesPaper ? "✓ Cited a paper" : "✗ Did not cite a paper");
    }
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
