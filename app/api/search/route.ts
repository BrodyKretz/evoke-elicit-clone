import { NextResponse } from "next/server";
import { isCorpusProvider, searchPapers } from "@/lib/corpus";

// Live search over the chosen corpus. Body: { query, limit?, corpus? }.
// Returns Paper[] in our internal schema.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    limit?: number;
    corpus?: string;
  };

  const provider = isCorpusProvider(body.corpus) ? body.corpus : "s2";

  try {
    const results = await searchPapers(provider, body.query ?? "", body.limit ?? 20);
    return NextResponse.json({ results, totalSources: results.length, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message, provider }, { status: 502 });
  }
}
