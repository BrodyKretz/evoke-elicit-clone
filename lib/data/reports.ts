import type { Report } from "@/lib/types";
import { getRun, listRuns } from "@/lib/store";
import lennoxGastaut from "./fixtures/lennox-gastaut";
import cbtDepression from "./fixtures/cbt-depression";
import prostateCancer from "./fixtures/prostate-cancer";

// Three seeded reports. Stable, demoable, never written to.
const fixtures: Record<string, Report> = {
  [lennoxGastaut.id]: lennoxGastaut,
  [cbtDepression.id]: cbtDepression,
  [prostateCancer.id]: prostateCancer,
};

// Reports surface from two places:
//   - the immutable `fixtures` registry above (the three demo reports)
//   - the JSON-file store (real user-created runs)
// Fixtures win on id collision.

export function listReports(): Report[] {
  const runs = listRuns();
  return [...Object.values(fixtures), ...runs.filter((r) => !fixtures[r.id])];
}

export function getReport(id: string): Report | undefined {
  return fixtures[id] ?? getRun(id);
}
