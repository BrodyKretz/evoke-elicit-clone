// Standalone smoke test for the .pdf exporter, mirroring test-pptx.ts.
//
// Usage: source ~/.nvm/nvm.sh && nvm use 20 && npx tsx scripts/test-pdf.ts

import { writeFileSync, statSync } from "node:fs";
import lennoxGastaut from "../lib/data/fixtures/lennox-gastaut";
import { exportReportAsPdf, pdfFilename } from "../lib/export/pdf";

async function main() {
  const fixture = lennoxGastaut;
  console.log(`Exporting fixture: ${fixture.id}`);
  console.log(`Question: ${fixture.question}`);
  console.log(`Body blocks: ${fixture.report?.length ?? 0}\n`);

  const t0 = Date.now();
  const buf = await exportReportAsPdf(fixture);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  const outPath = `/tmp/${pdfFilename(fixture)}`;
  writeFileSync(outPath, buf);
  const size = statSync(outPath).size;

  const head = buf.slice(0, 5).toString();
  const isPdf = head === "%PDF-";
  console.log(`Built in ${elapsed}s`);
  console.log(`Wrote ${outPath} (${(size / 1024).toFixed(1)} KB)`);
  console.log(isPdf ? "✓ Has %PDF- magic header" : `✗ Not a valid pdf (first bytes: ${head})`);
  if (!isPdf) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
