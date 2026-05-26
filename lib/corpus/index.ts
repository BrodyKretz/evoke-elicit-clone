// Single corpus interface. Dispatches to the chosen provider.
//
// Adding a new corpus (OpenAlex, arXiv-only, etc.) is one file + one entry in
// the PROVIDERS map. Everything downstream — agents, UI, persistence — is
// indifferent to which corpus produced the Paper[].

import * as s2 from "./semantic-scholar";
import * as core from "./core";
import type { Paper } from "../types";

export type CorpusProvider = "s2" | "core";

export const PROVIDERS: Record<CorpusProvider, { label: string; envKey: string }> = {
  s2: { label: "Semantic Scholar", envKey: "SEMANTIC_SCHOLAR_API_KEY" },
  core: { label: "CORE", envKey: "CORE_API_KEY" },
};

export function isCorpusProvider(x: unknown): x is CorpusProvider {
  return x === "s2" || x === "core";
}

export async function searchPapers(
  provider: CorpusProvider,
  query: string,
  limit = 25
): Promise<Paper[]> {
  switch (provider) {
    case "core":
      return core.searchPapers(query, limit);
    case "s2":
    default:
      return s2.searchPapers(query, limit);
  }
}

// BYO-papers entrypoint: resolve identifiers (DOI / arXiv / PMID / S2 id) to
// Paper records. S2 only — CORE has no batch endpoint with equivalent shape.
export async function resolvePapersByIds(ids: string[]): Promise<Paper[]> {
  return s2.resolveByIds(ids);
}

// Citation chasing — fetch a paper's references. S2 only for now.
export async function getReferences(paperId: string, limit = 15): Promise<Paper[]> {
  return s2.getReferences(paperId, limit);
}
