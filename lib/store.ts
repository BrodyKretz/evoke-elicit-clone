// JSON-file persistence for user-created runs. Fixtures live separately in lib/data/.
// Will be replaced by SQLite once we need real queries (Session 3+).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Report } from "./types";

const STORE_PATH = resolve(process.cwd(), ".evoke", "runs.json");

type Store = { reports: Record<string, Report> };

function read(): Store {
  if (!existsSync(STORE_PATH)) return { reports: {} };
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as Store;
  } catch {
    // Corrupt file — return empty and let the next write overwrite it.
    return { reports: {} };
  }
}

function write(store: Store) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function saveRun(report: Report) {
  const store = read();
  store.reports[report.id] = report;
  write(store);
}

export function getRun(id: string): Report | undefined {
  return read().reports[id];
}

export function listRuns(): Report[] {
  return Object.values(read().reports);
}

export function newRunId() {
  // Built-in randomUUID (Node 19+). Format: 8-4-4-4-12 hex.
  // Truncate to first segment for readable URLs.
  return globalThis.crypto.randomUUID().split("-")[0];
}
