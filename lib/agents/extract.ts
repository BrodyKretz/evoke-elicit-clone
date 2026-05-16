import { anthropic, MODELS } from "@/lib/anthropic";
import type { EmitFn } from "@/lib/events";
import { pMap } from "@/lib/utils/p-map";
import type { CellEvidence, Paper, Report } from "@/lib/types";

const COLUMN_COUNT = 4;

// Pass 1: choose what columns the extraction table should have. One Sonnet
// call, forced tool use → returns exactly COLUMN_COUNT strings.
export async function generateColumns(question: string): Promise<string[]> {
  if (!question.trim()) throw new Error("question is empty");

  const res = await anthropic().messages.create({
    model: MODELS.extraction,
    max_tokens: 600,
    system:
      `You design extraction tables for systematic literature reviews. Given a research question, propose exactly ${COLUMN_COUNT} column headers for a table that captures the most relevant per-paper data needed to answer the question.\n\nGuidelines:\n- Each header should be 2-5 words.\n- Headers should be answerable from a paper's abstract.\n- Cover: methodology, sample, outcomes/findings, and one column tailored to the specific question (intervention, biomarker, population, etc).\n- Do NOT include a "Paper" or "Citation" column — the UI handles that.`,
    tools: [
      {
        name: "propose_columns",
        description: "Record the proposed extraction-table columns.",
        input_schema: {
          type: "object",
          properties: {
            columns: {
              type: "array",
              items: { type: "string" },
              minItems: COLUMN_COUNT,
              maxItems: COLUMN_COUNT,
              description: `Exactly ${COLUMN_COUNT} column headers.`,
            },
          },
          required: ["columns"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "propose_columns" },
    messages: [{ role: "user", content: `Research question: ${question}` }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("column generation: no tool_use block in response");
  }
  const input = block.input as { columns?: unknown };
  if (!Array.isArray(input.columns)) {
    throw new Error("column generation: columns is not an array");
  }
  const columns = input.columns
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.trim());
  if (columns.length === 0) {
    throw new Error("column generation: no usable columns returned");
  }
  // Pad or truncate defensively — the model usually returns exactly COLUMN_COUNT
  // but we don't want a missing column to crash the pipeline.
  while (columns.length < COLUMN_COUNT) columns.push("Notes");
  return columns.slice(0, COLUMN_COUNT);
}

// Pass 2: fill the row for one paper. Returns one cell value per column +
// optional per-cell evidence (short quoted phrases from the abstract).
async function extractFromPaper(
  paper: Paper,
  columns: string[],
  question: string
): Promise<{ cells: string[]; evidence: CellEvidence[] }> {
  const abstract = paper.abstract?.slice(0, 6000) ?? "(no abstract available)";

  const res = await anthropic().messages.create({
    model: MODELS.extraction,
    max_tokens: 1500,
    system:
      "You extract structured data from research-paper abstracts for systematic literature reviews. For each column, return a concise cell value (one phrase or 1-3 short bullets) AND a list of short verbatim quotes from the abstract that support it. If the abstract doesn't specify a column's value, write 'Insufficient data' or 'Not reported in abstract' and provide an empty quotes list. Do NOT invent values or quotes.",
    tools: [
      {
        name: "record_extraction",
        description: "Record the extracted cells (one per column, in order).",
        input_schema: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: "string", description: "The cell's value." },
                  quotes: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Short verbatim phrases from the abstract that support the value. Empty when the abstract doesn't specify.",
                  },
                },
                required: ["value", "quotes"],
              },
              minItems: columns.length,
              maxItems: columns.length,
              description: `Exactly ${columns.length} cells, in the same order as the column list.`,
            },
          },
          required: ["rows"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_extraction" },
    messages: [
      {
        role: "user",
        content: `Research question: ${question}\n\nColumns (in order):\n${columns
          .map((c, i) => `${i + 1}. ${c}`)
          .join("\n")}\n\nPaper:\nTitle: ${paper.title}\n${
          paper.journal ? `Journal: ${paper.journal} (${paper.year})\n` : ""
        }Abstract: ${abstract}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(`extraction: no tool_use block for paper ${paper.id}`);
  }
  const input = block.input as { rows?: unknown };
  if (!Array.isArray(input.rows)) {
    throw new Error(`extraction: rows is not an array for paper ${paper.id}`);
  }
  const cells: string[] = [];
  const evidence: CellEvidence[] = [];
  for (const raw of input.rows) {
    if (!raw || typeof raw !== "object") {
      cells.push("Insufficient data");
      evidence.push({ quotes: [] });
      continue;
    }
    const row = raw as Record<string, unknown>;
    cells.push(typeof row.value === "string" ? row.value.trim() : "Insufficient data");
    evidence.push({
      quotes: Array.isArray(row.quotes)
        ? row.quotes.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        : [],
    });
  }
  // Defensive pad/truncate.
  while (cells.length < columns.length) {
    cells.push("Insufficient data");
    evidence.push({ quotes: [] });
  }
  return {
    cells: cells.slice(0, columns.length),
    evidence: evidence.slice(0, columns.length),
  };
}

// Drive the full extraction for a set of papers.
// Returns the same shape Report.extraction expects.
export async function extractPapers(
  papers: Paper[],
  question: string,
  concurrency = 3,
  onEvent?: EmitFn
): Promise<NonNullable<Report["extraction"]> & { columns: string[] }> {
  if (papers.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = await generateColumns(question);
  onEvent?.({ type: "columns", columns });

  let done = 0;
  const cellGrids = await pMap(papers, concurrency, async (paper) => {
    try {
      const result = await extractFromPaper(paper, columns, question);
      done++;
      onEvent?.({ type: "progress", stage: "extract", done, total: papers.length });
      return result;
    } catch (err) {
      done++;
      onEvent?.({ type: "progress", stage: "extract", done, total: papers.length });
      console.error(`extraction failed for ${paper.id}:`, err);
      return {
        cells: columns.map(() => "Extraction failed"),
        evidence: columns.map(() => ({ quotes: [] })),
      };
    }
  });

  return {
    columns,
    rows: papers.map((paper, i) => ({
      paper,
      cells: cellGrids[i].cells,
      evidence: cellGrids[i].evidence,
    })),
  };
}
