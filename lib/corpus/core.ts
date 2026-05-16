// CORE API client (https://core.ac.uk).
//
// CORE differentiates from Semantic Scholar by exposing full-text content
// for open-access papers, not just abstracts. The agents still read abstracts
// by default; future extraction quality improvements can opt into full text
// by populating `Paper.abstract` from CORE's `fullText` field when present.
//
// Auth: requires CORE_API_KEY in env. Apply at https://core.ac.uk/services/api.

import type { Paper } from "../types";

const CORE_BASE = "https://api.core.ac.uk/v3";

type CoreAuthor = { name?: string };

type CoreWork = {
  id?: number | string;
  title?: string | null;
  abstract?: string | null;
  fullText?: string | null;
  authors?: CoreAuthor[] | null;
  yearPublished?: number | null;
  publisher?: string | null;
  doi?: string | null;
  downloadUrl?: string | null;
  citationCount?: number | null;
};

function toPaper(w: CoreWork): Paper {
  return {
    id: String(w.id ?? `core-${Math.random().toString(36).slice(2, 10)}`),
    title: w.title ?? "Untitled paper",
    authors: (w.authors ?? [])
      .map((a) => (typeof a?.name === "string" ? a.name : ""))
      .filter((s): s is string => s.length > 0),
    year: w.yearPublished ?? 0,
    journal: w.publisher ?? undefined,
    citations: w.citationCount ?? undefined,
    doi: w.doi ?? undefined,
    // Prefer the abstract when present; fall back to a slice of full text so
    // downstream agents still have *something* to work with.
    abstract: w.abstract ?? (w.fullText ? w.fullText.slice(0, 4000) : undefined),
    fullTextAvailable: Boolean(w.downloadUrl) || Boolean(w.fullText),
    summary: undefined,
  };
}

export async function searchPapers(query: string, limit = 20): Promise<Paper[]> {
  if (!query.trim()) return [];
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey) {
    throw new Error("CORE_API_KEY missing from environment. Add it to .env.local.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${CORE_BASE}/search/works`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        q: query,
        limit,
        offset: 0,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { results?: CoreWork[]; totalHits?: number };
      return (json.results ?? []).map(toPaper);
    }
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === maxAttempts) {
      const body = await res.text().catch(() => "");
      throw new Error(`CORE ${res.status}: ${body.slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
  return [];
}
