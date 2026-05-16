import { NextResponse } from "next/server";
import { isCorpusProvider, searchPapers } from "@/lib/corpus";
import { suggestCorrectedQuery } from "@/lib/agents/normalize";

// Standalone paper-search endpoint backing the Lab > Find Papers tool.
// Wraps lib/corpus.searchPapers so the client can hit either corpus with
// a single fetch, without going through the full pipeline. Runs a Haiku
// typo-correction pass on every query because corpora (especially CORE)
// happily return noise on misspellings instead of zero hits.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const corpusParam = url.searchParams.get("corpus") ?? "s2";
  const limitParam = Number(url.searchParams.get("limit") ?? "20");

  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }
  if (!isCorpusProvider(corpusParam)) {
    return NextResponse.json({ error: "corpus must be 's2' or 'core'" }, { status: 400 });
  }
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  // Silently correct obvious typos before hitting the corpus. Failures here
  // are non-fatal — we just fall back to the original query.
  const corrected = await suggestCorrectedQuery(q).catch(() => null);
  const effectiveQuery = corrected && corrected !== q ? corrected : q;

  try {
    const papers = await searchPapers(corpusParam, effectiveQuery, limit);
    return NextResponse.json({
      papers,
      originalQuery: q,
      effectiveQuery,
      correctedQuery: corrected && corrected !== q ? corrected : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
