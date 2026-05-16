// Standalone smoke test for the .pptx exporter. Bypasses the Next.js dev
// server (currently flaky in this env) so we can confirm the export logic
// itself works against a real fixture.
//
// Usage: source ~/.nvm/nvm.sh && nvm use 20 && npx tsx scripts/test-pptx.ts

import { writeFileSync, statSync } from "node:fs";
import lennoxGastaut from "../lib/data/fixtures/lennox-gastaut";
import { exportReportAsPptx, pptxFilename } from "../lib/export/pptx";

async function main() {
  const fixture = lennoxGastaut; // has a real synthesized `report` body
  console.log(`Exporting fixture: ${fixture.id}`);
  console.log(`Question: ${fixture.question}`);
  console.log(`Body blocks: ${fixture.report?.length ?? 0}\n`);

  const t0 = Date.now();
  const buf = await exportReportAsPptx(fixture);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  const outPath = `/tmp/${pptxFilename(fixture)}`;
  writeFileSync(outPath, buf);

  const size = statSync(outPath).size;
  const head = buf.slice(0, 4);
  const isPK = head[0] === 0x50 && head[1] === 0x4b; // "PK" zip magic

  console.log(`Built in ${elapsed}s`);
  console.log(`Wrote ${outPath} (${(size / 1024).toFixed(1)} KB)`);
  console.log(isPK ? "✓ Has ZIP/PPTX magic header (PK)" : `✗ Not a valid pptx (first bytes: ${head.toString("hex")})`);

  if (!isPK) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
