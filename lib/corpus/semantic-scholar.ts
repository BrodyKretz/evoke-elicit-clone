import type { Paper } from "../types";
import { getRequestKeys } from "../request-context";

function s2ApiKey(): string | undefined {
  return getRequestKeys().s2Key ?? process.env.SEMANTIC_SCHOLAR_API_KEY;
}

const S2_BASE = "https://api.semanticscholar.org/graph/v1";

// Fields we want from S2 in a single comma-separated string.
const PAPER_FIELDS = [
  "paperId",
  "title",
  "abstract",
  "year",
  "authors",
  "venue",
  "citationCount",
  "openAccessPdf",
  "externalIds",
].join(",");

type S2Author = { authorId?: string; name?: string };

type S2Paper = {
  paperId: string;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  authors?: S2Author[] | null;
  venue?: string | null;
  citationCount?: number | null;
  openAccessPdf?: { url: string } | null;
  externalIds?: Record<string, string> | null;
};

function toPaper(s: S2Paper): Paper {
  return {
    id: s.paperId,
    title: s.title ?? "Untitled paper",
    authors: (s.authors ?? []).map((a) => a.name ?? "Unknown").filter(Boolean),
    year: s.year ?? 0,
    journal: s.venue ?? undefined,
    citations: s.citationCount ?? undefined,
    doi: s.externalIds?.DOI,
    abstract: s.abstract ?? undefined,
    fullTextAvailable: Boolean(s.openAccessPdf?.url),
    // No LLM yet — leave summary undefined; SearchView will fall back to abstract.
    summary: undefined,
  };
}

/**
 * Hit S2's keyword search. Returns top-N papers ranked by S2's own relevance.
 *
 * Auth: passes x-api-key header if SEMANTIC_SCHOLAR_API_KEY is set in env;
 * otherwise relies on the (rate-limited) unauthenticated tier — which 429s
 * aggressively, so we retry with exponential backoff.
 */
export async function searchPapers(query: string, limit = 20): Promise<Paper[]> {
  if (!query.trim()) return [];

  const url = new URL(`${S2_BASE}/paper/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", PAPER_FIELDS);

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = s2ApiKey();
  if (key) headers["x-api-key"] = key;

  // Retry up to 4 times with exponential backoff on 429/5xx.
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { data?: S2Paper[]; total?: number };
      return (json.data ?? []).map(toPaper);
    }
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === maxAttempts) {
      const body = await res.text().catch(() => "");
      throw new Error(`Semantic Scholar ${res.status}: ${body.slice(0, 200)}`);
    }
    // Backoff: 1s, 2s, 4s. The unauth tier window is ~1s.
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
  // unreachable — loop above either returns or throws
  return [];
}

/**
 * Fetch references cited by a given paper. Returns up to `limit` cited papers
 * with the same Paper shape as searchPapers. Drops entries S2 couldn't resolve.
 */
export async function getReferences(paperId: string, limit = 15): Promise<Paper[]> {
  const url = new URL(`${S2_BASE}/paper/${encodeURIComponent(paperId)}/references`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", PAPER_FIELDS.split(",").map((f) => `citedPaper.${f}`).join(","));

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = s2ApiKey();
  if (key) headers["x-api-key"] = key;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ citedPaper?: S2Paper | null }> };
      return (json.data ?? [])
        .map((r) => r.citedPaper)
        .filter((p): p is S2Paper => Boolean(p && p.paperId))
        .map(toPaper);
    }
    if (res.status === 404) return [];
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Semantic Scholar references ${res.status}: ${body.slice(0, 200)}`);
  }
  return [];
}

/**
 * Resolve a list of paper identifiers (DOI:..., ARXIV:..., PMID:..., or
 * bare S2 paperId) to Paper records. Tries the /paper/batch endpoint first;
 * if that's rate-limited (the unauth tier rejects batch aggressively) it
 * falls back to per-id /paper/{id} sequentially. Misses are silently dropped.
 */
export async function resolveByIds(ids: string[]): Promise<Paper[]> {
  if (ids.length === 0) return [];

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = s2ApiKey();
  if (key) headers["x-api-key"] = key;

  // First try batch — fast path when it works.
  const batchUrl = new URL(`${S2_BASE}/paper/batch`);
  batchUrl.searchParams.set("fields", PAPER_FIELDS);
  try {
    const res = await fetch(batchUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as Array<S2Paper | null>;
      return body.filter((p): p is S2Paper => p != null).map(toPaper);
    }
    // 429 / 5xx → fall through to per-id resolver.
    if (!(res.status === 429 || res.status >= 500)) {
      const text = await res.text().catch(() => "");
      throw new Error(`Semantic Scholar batch ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    // Network errors also trip the fallback; only re-throw if it's our
    // own thrown error from above.
    if (err instanceof Error && err.message.startsWith("Semantic Scholar batch")) {
      throw err;
    }
  }

  // Per-id fallback. Sequential with a tiny gap so we stay under the
  // unauth tier's ~1 req/sec quota. Misses (404) and 429s after retry
  // are silently skipped — better to return partial than nothing.
  const out: Paper[] = [];
  for (const id of ids) {
    const encoded = encodeURIComponent(id);
    const single = new URL(`${S2_BASE}/paper/${encoded}`);
    single.searchParams.set("fields", PAPER_FIELDS);

    let resolved: Paper | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(single, { headers, cache: "no-store" });
      if (r.ok) {
        const p = (await r.json()) as S2Paper;
        resolved = toPaper(p);
        break;
      }
      if (r.status === 404) break; // genuine miss
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 500 * 2 ** (attempt - 1)));
        continue;
      }
      break;
    }
    if (resolved) out.push(resolved);
    await new Promise((res) => setTimeout(res, 220));
  }
  return out;
}
