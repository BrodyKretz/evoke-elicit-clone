// Edge-case probes for the chat agent's new prefer-grounded-with-fallback
// policy. Not committed to the regular smoke-test suite — meant to be run
// during eval/tuning passes.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-chat-edges.ts

import lennoxGastaut from "../lib/data/fixtures/lennox-gastaut";
import { chat } from "../lib/agents/chat";

type Case = {
  q: string;
  expect: "in-run-only" | "background-label" | "mixed-with-label" | "off-topic-decline";
  note: string;
};

const cases: Case[] = [
  {
    q: "What does GPFA stand for and what does it look like on an EEG?",
    expect: "background-label",
    note: "Definitional — papers reference GPFA but probably don't spell out the acronym or describe its visual pattern in detail.",
  },
  {
    q: "Compare HRV findings to EEG findings in this run, and explain in general what HRV measures.",
    expect: "mixed-with-label",
    note: "First half is in-run comparison; second half is general background. Model should answer both, label only the background portion.",
  },
  {
    q: "Which of these biomarkers would you recommend monitoring in a newly diagnosed pediatric LGS patient?",
    expect: "in-run-only",
    note: "Clinical recommendation. The model should ground it in the run's findings (slow spike-wave, GPFA, etc.) without prescribing medical advice.",
  },
  {
    q: "Who won the 2024 World Series?",
    expect: "off-topic-decline",
    note: "Completely unrelated — should decline.",
  },
  {
    q: "What's a fun pizza topping?",
    expect: "off-topic-decline",
    note: "Soft off-topic — should still decline.",
  },
];

const BG_LABEL = "**General background (not from your papers):**";

async function main() {
  console.log(`Edge-case chat probes against: "${lennoxGastaut.question}"\n`);

  const summary: { q: string; expect: string; pass: boolean; reason: string }[] = [];

  for (const c of cases) {
    console.log(`────────────────────────────────────────`);
    console.log(`Q: ${c.q}`);
    console.log(`[expect: ${c.expect}] ${c.note}`);
    process.stdout.write("A: ");
    const full = await chat(lennoxGastaut, [], c.q, (chunk) =>
      process.stdout.write(chunk)
    );
    console.log("\n");

    const lower = full.toLowerCase();
    const hasLabel = full.includes(BG_LABEL);
    const declined =
      lower.includes("can only") ||
      lower.includes("related to your current research") ||
      lower.includes("don't have access") ||
      lower.includes("can't help");
    // Accept either "Paper [N]" / "Papers [N, ...]" or named citations like
    // "Hödl et al., 2021" — both are legitimate ways to reference a study.
    const citesPaper =
      /papers?\s*\[\d+/i.test(full) ||
      /\[papers?\s*\d+/i.test(full) ||
      /\bet al\.?,?\s*\d{4}/i.test(full);

    let pass = false;
    let reason = "";
    switch (c.expect) {
      case "background-label":
        pass = hasLabel;
        reason = pass ? "label present" : "missing label";
        break;
      case "mixed-with-label":
        pass = hasLabel && citesPaper;
        reason = pass
          ? "label + paper cite both present"
          : `missing: ${!hasLabel ? "label " : ""}${!citesPaper ? "cite" : ""}`;
        break;
      case "in-run-only":
        pass = !hasLabel && citesPaper;
        reason = pass
          ? "grounded without label"
          : `${hasLabel ? "unexpected label " : ""}${!citesPaper ? "missing cite" : ""}`;
        break;
      case "off-topic-decline":
        pass = declined && !hasLabel;
        reason = pass ? "declined cleanly" : `${!declined ? "did not decline " : ""}${hasLabel ? "drifted via background label" : ""}`;
        break;
    }

    console.log(pass ? `✓ ${reason}` : `✗ ${reason}`);
    summary.push({ q: c.q, expect: c.expect, pass, reason });
  }

  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================");
  let passes = 0;
  for (const s of summary) {
    console.log(`${s.pass ? "✓" : "✗"} [${s.expect}] ${s.q.slice(0, 60)}${s.q.length > 60 ? "..." : ""} — ${s.reason}`);
    if (s.pass) passes++;
  }
  console.log(`\n${passes}/${summary.length} passed`);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
