import { NextResponse } from "next/server";
import { resolvePapersByIds } from "@/lib/corpus";
import { parseIds } from "@/lib/identifiers";

// BYO papers — take free-text input (DOIs, DOI URLs, arXiv ids/links,
// PubMed ids), normalize, and resolve via S2 batch.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const parsed = parseIds(text);
  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No DOIs, arXiv ids, or PubMed ids found in input" },
      { status: 400 }
    );
  }

  // Hard cap so a giant paste can't blow up the batch endpoint.
  const ids = parsed.slice(0, 100).map((p) => p.s2Id);

  try {
    const papers = await resolvePapersByIds(ids);
    const missed = ids.length - papers.length;
    return NextResponse.json({
      papers,
      parsedCount: parsed.length,
      requestedCount: ids.length,
      missedCount: Math.max(0, missed),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "resolve failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
