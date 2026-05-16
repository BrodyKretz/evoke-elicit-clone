import { NextResponse } from "next/server";
import { extractPapers } from "@/lib/agents/extract";
import type { Paper } from "@/lib/types";

// Lab > Extract data endpoint. Runs extractPapers() against an arbitrary
// paper set. Non-streaming — just returns the table.
// Body: { papers: Paper[], question: string }

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    papers?: Paper[];
    question?: string;
  };

  const papers = Array.isArray(body.papers) ? body.papers : [];
  if (papers.length === 0) {
    return NextResponse.json({ error: "no papers selected" }, { status: 400 });
  }
  const screenable = papers.filter((p) => p.abstract && p.abstract.trim().length > 0);
  if (screenable.length === 0) {
    return NextResponse.json(
      { error: "none of the selected papers have abstracts available — extraction requires abstract text" },
      { status: 400 }
    );
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question required (used to guide column generation)" }, { status: 400 });
  }

  try {
    const result = await extractPapers(screenable, question, 3);
    return NextResponse.json({
      columns: result.columns,
      rows: result.rows.map((r) => ({
        paperId: r.paper.id,
        paperTitle: r.paper.title,
        paperYear: r.paper.year,
        paperAuthors: r.paper.authors,
        cells: r.cells,
        evidence: r.evidence,
      })),
      skipped: papers.length - screenable.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "extraction failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
