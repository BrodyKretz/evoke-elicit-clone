// Smoke test for the action-chip wiring. Drives the synthesis agent against
// the prostate-cancer fixture's hand-written extraction three times — once
// per action — and inspects the block structure of each result. Confirms
// that the three actions produce *meaningfully* different shapes.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/test-action-chips.ts

import prostateCancer from "../lib/data/fixtures/prostate-cancer";
import { synthesizeReport, type SynthesisAction } from "../lib/agents/synthesize";
import type { ReportBlock } from "../lib/types";

type Shape = {
  total: number;
  paragraph: number;
  table: number;
  notes: number;
  heading: number;
  sectionLabel: number;
  tableRows: number;
  notesBullets: number;
};

function shapeOf(blocks: ReportBlock[]): Shape {
  const s: Shape = {
    total: blocks.length,
    paragraph: 0,
    table: 0,
    notes: 0,
    heading: 0,
    sectionLabel: 0,
    tableRows: 0,
    notesBullets: 0,
  };
  for (const b of blocks) {
    s[b.kind] = (s[b.kind] ?? 0) + 1;
    if (b.kind === "table") s.tableRows += b.rows.length;
    if (b.kind === "notes") s.notesBullets += b.items.length;
  }
  return s;
}

async function runOne(label: string, action: SynthesisAction) {
  console.log(`──── ${label} (action=${action}) ────`);
  const extraction = prostateCancer.extraction;
  if (!extraction) throw new Error("fixture missing extraction");
  const start = Date.now();
  const { tldr, blocks } = await synthesizeReport(
    prostateCancer.question,
    extraction,
    null,
    action
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const s = shapeOf(blocks);

  console.log(`Done in ${elapsed}s. TLDR: ${tldr.slice(0, 120)}…`);
  console.log(
    `  blocks=${s.total}  paragraph=${s.paragraph}  table=${s.table} (${s.tableRows} rows)  notes=${s.notes} (${s.notesBullets} bullets)  heading=${s.heading}  sectionLabel=${s.sectionLabel}`
  );
  return { action, shape: s };
}

async function main() {
  console.log("Action-chip output-shape test\n");

  const r1 = await runOne("Default report", "report");
  console.log();
  const r2 = await runOne("Table", "table");
  console.log();
  const r3 = await runOne("Slides", "slides");

  console.log("\n========================================");
  console.log("ASSERTIONS");
  console.log("========================================");

  // Table action: table block dominant, paragraphs minimal.
  const tableDominant = r2.shape.table >= 1 && r2.shape.tableRows >= 3;
  const tableLowParagraphs = r2.shape.paragraph <= r1.shape.paragraph;
  console.log(
    tableDominant ? "✓ table action: table present with ≥3 rows" : "✗ table action: no dominant table"
  );
  console.log(
    tableLowParagraphs
      ? "✓ table action: fewer or equal paragraphs vs default"
      : `✗ table action: ${r2.shape.paragraph} paragraphs vs default ${r1.shape.paragraph}`
  );

  // Slides action: notes blocks dominate, paragraphs near zero.
  const slidesNotesHeavy = r3.shape.notes >= 4;
  const slidesLowParagraphs = r3.shape.paragraph <= 1;
  console.log(
    slidesNotesHeavy
      ? `✓ slides action: ${r3.shape.notes} notes blocks (slide-deck style)`
      : `✗ slides action: only ${r3.shape.notes} notes blocks`
  );
  console.log(
    slidesLowParagraphs
      ? `✓ slides action: ≤1 paragraphs (${r3.shape.paragraph})`
      : `✗ slides action: too many paragraphs (${r3.shape.paragraph})`
  );

  // Default report: at least 2 paragraphs + 1 table.
  const defaultOk = r1.shape.paragraph >= 2 && r1.shape.table >= 1;
  console.log(
    defaultOk
      ? `✓ default action: narrative + table present`
      : `✗ default action: missing narrative or table (paragraph=${r1.shape.paragraph} table=${r1.shape.table})`
  );

  // Cross-action distinctness — the three shapes shouldn't all collapse.
  const allDistinct =
    !(r1.shape.notes === r2.shape.notes && r1.shape.notes === r3.shape.notes) ||
    !(r1.shape.paragraph === r2.shape.paragraph && r1.shape.paragraph === r3.shape.paragraph);
  console.log(
    allDistinct
      ? "✓ shapes differ across actions"
      : "✗ all three actions produced the same shape"
  );

  console.log();
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
