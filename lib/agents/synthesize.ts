import { anthropic, MODELS } from "@/lib/anthropic";
import type { Paper, Report, ReportBlock } from "@/lib/types";

// ---- helpers ---------------------------------------------------------------

// Render a paper as a short bibliographic line for the LLM. We do NOT include
// the abstract here — the extraction table is the synthesis input. The LLM
// references papers by index (1-based) so we surface that explicitly.
function formatPaperRef(paper: Paper, idx: number): string {
  const authors =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(", ")} et al.`
      : paper.authors.join(", ");
  return `[${idx + 1}] ${authors} (${paper.year || "n.d."}). ${paper.title}${
    paper.journal ? ` — ${paper.journal}` : ""
  }.`;
}

// Render the extraction table as a tab-separated markdown-ish block the LLM
// can read efficiently. Cells are quoted because they often contain commas.
function formatExtractionTable(extraction: NonNullable<Report["extraction"]>) {
  const header = ["#", ...extraction.columns].join("\t");
  const rows = extraction.rows.map((r, i) =>
    [`${i + 1}`, ...r.cells.map((c) => c.replaceAll("\t", " ").replaceAll("\n", " | "))].join("\t")
  );
  return [header, ...rows].join("\n");
}

// ---- TLDR call -------------------------------------------------------------

export async function generateTldr(
  question: string,
  extraction: NonNullable<Report["extraction"]>
): Promise<string> {
  if (!question.trim()) throw new Error("question is empty");
  if (extraction.rows.length === 0) {
    return "Insufficient data to answer the research question.";
  }

  const res = await anthropic().messages.create({
    model: MODELS.synthesis,
    max_tokens: 800,
    system:
      "You write a single-sentence answer to a research question, based on a structured extraction table of papers. The answer should be factual, specific, and synthesize across the papers — not just paraphrase one. Avoid hedging language unless the evidence genuinely warrants it. Output the answer via the `record_tldr` tool.",
    tools: [
      {
        name: "record_tldr",
        description: "Record the one-sentence answer to the research question.",
        input_schema: {
          type: "object",
          properties: {
            tldr: {
              type: "string",
              description: "A single sentence answering the question.",
            },
          },
          required: ["tldr"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_tldr" },
    messages: [
      {
        role: "user",
        content: `Research question: ${question}\n\nExtraction table (papers × fields):\n${formatExtractionTable(
          extraction
        )}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("tldr: no tool_use block");
  const input = block.input as { tldr?: string };
  if (!input.tldr?.trim()) throw new Error("tldr: empty answer");
  return input.tldr.trim();
}

// ---- Body call -------------------------------------------------------------

// JSON Schema for one ReportBlock — discriminated union on `kind`.
// Anthropic tool input_schema accepts JSON Schema with anyOf; we keep it
// explicit rather than $ref'd for readability.
const BLOCK_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["paragraph"] },
        text: { type: "string", description: "One paragraph of prose." },
        cites: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          description:
            "1-based paper indices supporting the claims in this paragraph. Use the same numbering as the paper list in the prompt. Empty array if the paragraph doesn't make a cite-able claim.",
        },
      },
      required: ["kind", "text", "cites"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["heading"] },
        level: { type: "integer", enum: [2, 3, 4] },
        text: { type: "string" },
      },
      required: ["kind", "level", "text"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["sectionLabel"] },
        text: {
          type: "string",
          description: "Short uppercase-style label (e.g. 'Abstract', 'Results').",
        },
      },
      required: ["kind", "text"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["table"] },
        columns: { type: "array", items: { type: "string" }, minItems: 2 },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "Each row is an array of strings, one per column.",
        },
      },
      required: ["kind", "columns", "rows"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["notes"] },
        title: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              children: {
                type: "array",
                items: {
                  type: "object",
                  properties: { text: { type: "string" } },
                  required: ["text"],
                },
              },
            },
            required: ["text"],
          },
        },
      },
      required: ["kind", "items"],
    },
  ],
} as const;

export type SynthesisAction = "table" | "slides" | "report";

const REPORT_STRUCTURE = `OUTPUT STRUCTURE (in order):
1. sectionLabel "Abstract"
2. 2 paragraph blocks summarizing the key findings across papers. Each paragraph should cite the number of supporting papers via the \`cites\` field. Synthesize — do NOT just enumerate paper-by-paper.
3. sectionLabel "Results"
4. heading (level 3) for the main results section, e.g. "Findings across studies"
5. 1 table block summarizing the most useful cross-paper dimension (subset/aggregate the extraction columns; do not copy verbatim).
6. 1 notes block with a "Summary statistics" title — bullets aggregating across papers (e.g. study design counts, sample-size ranges).
7. 1 notes block titled "Evidence strength" — 3-6 bullets, one per major finding/target/intervention, each in this exact shape:
     "<finding> — <mature | preclinical | exploratory>: <one-sentence why>"
   Definitions: "mature" = has been tested in human clinical trials (cite the trial paper if available). "preclinical" = cell-line/animal/PDX evidence only. "exploratory" = mechanistic hypothesis or correlational signal without intervention data. Be honest — most things will be preclinical or exploratory.
8. sectionLabel "Summary"
9. 1-2 paragraph blocks concluding the report.`;

const TABLE_STRUCTURE = `OUTPUT STRUCTURE — table-first (user clicked "Create table"):
1. sectionLabel "Comparison table"
2. heading (level 3) — short title for what's being compared.
3. 1 paragraph block (≤2 sentences) describing the table's scope. Empty cites array.
4. 1 table block that is the main artifact — include 4-6 columns and one row per paper. Pick columns that maximally differentiate the papers (e.g., sample size, intervention, primary outcome, effect, limitations). Do NOT just copy the extraction columns verbatim.
5. 1 notes block with title "Key contrasts" — 3-5 bullets calling out important contrasts visible in the table.
6. sectionLabel "Caveats"
7. 1 short paragraph block flagging gaps or "Insufficient data" cells.

The user wants the TABLE to be the centerpiece. Spend tokens on getting the table comprehensive and the key-contrasts bullets sharp. Skip a long narrative.`;

const SLIDES_STRUCTURE = `OUTPUT STRUCTURE — slide-deck style (user clicked "Generate slides"):
Produce a series of "slides" where each slide is rendered as a notes block with a short title. Aim for 6-8 slides, in this order:
1. notes "Slide 1 — TL;DR" with 1-2 bullets answering the question in plain language.
2. notes "Slide 2 — Why this matters" with 2-3 bullets.
3. notes "Slide 3 — How we searched" with 2-3 bullets (corpus, criterion, number of papers screened/included).
4. 1 table block — short (≤4 rows, ≤4 columns) summarising the key cross-paper data.
5. notes "Slide 4 — Findings" with 3-4 bullets.
6. notes "Slide 5 — Disagreements / gaps" with 2-3 bullets.
7. notes "Slide 6 — What's next" with 2 bullets on open questions or follow-up work.
8. Optional notes "Slide 7 — Sources" with up to 5 bullets, each citing a Paper [N].

Use the notes \`children\` field sparingly (one level of indent at most). No paragraph blocks — keep each slide skim-readable.`;

function buildBodySystem(action: SynthesisAction): string {
  const structure =
    action === "table"
      ? TABLE_STRUCTURE
      : action === "slides"
      ? SLIDES_STRUCTURE
      : REPORT_STRUCTURE;

  return `You write structured research-report syntheses for systematic literature reviews. Given a research question and an extraction table of papers (papers × fields), produce a report body as an ordered list of typed blocks.

${structure}

STYLE:
- Be specific. Cite numbers from the extraction (sample sizes, counts of studies, percentages).
- Use "Insufficient data" / "not reported in abstract" honestly when the extraction has gaps; don't invent.
- Keep tables to ≤ 6 rows. If you'd include more, use the notes block to summarize instead.
- Paragraph \`cites\` is a 1-based index array into the papers list above (e.g. \`[1, 3]\` for papers 1 and 3). Use the same numbering as the paper list given in the prompt. Use an empty array \`[]\` for a paragraph that doesn't make a citeable claim.

CITATIONS — IMPORTANT:
- Inside every paragraph block's \`text\` field, place inline citation markers in the form \`[[N]]\` or \`[[N,M]]\` immediately after each claim. N,M are the same 1-based paper indices.
- Example: "AURKA inhibition shows the strongest signal in treatment-emergent NEPC [[1,4]]. EZH2 has preclinical support but limited clinical data [[2]]."
- One marker per sentence-level claim — do NOT lump them at the end of the paragraph. Transition sentences with no specific paper claim need no marker.
- When you use inline \`[[...]]\` markers, set the paragraph's \`cites\` field to \`[]\` (the inline markers replace the trailing cluster).
- Notes-block bullets and table cells should keep citations as plain "Paper [N]" text — inline \`[[...]]\` is reserved for paragraphs.

Output via the \`record_report\` tool — a single \`blocks\` array.`;
}

export async function generateBody(
  question: string,
  extraction: NonNullable<Report["extraction"]>,
  criterionText: string | null,
  action: SynthesisAction = "report"
): Promise<ReportBlock[]> {
  if (extraction.rows.length === 0) {
    return [
      { kind: "sectionLabel", text: "Abstract" },
      {
        kind: "paragraph",
        text: "No papers met the inclusion criteria for analysis.",
      },
    ];
  }

  const paperRefs = extraction.rows
    .map((r, i) => formatPaperRef(r.paper, i))
    .join("\n");

  const userMessage = [
    `Research question: ${question}`,
    criterionText ? `Inclusion criterion: ${criterionText}` : "",
    `Papers (${extraction.rows.length} total, referenced by index):\n${paperRefs}`,
    `Extraction table:\n${formatExtractionTable(extraction)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Adaptive thinking can't combine with forced tool_choice (API constraint).
  // Forced tool use wins — structural reliability of the typed-blocks output
  // matters more than thinking depth here. Effort still applies.
  const res = await anthropic().messages.create({
    model: MODELS.synthesis,
    max_tokens: 16000,
    output_config: { effort: "high" },
    system: buildBodySystem(action),
    tools: [
      {
        name: "record_report",
        description: "Record the structured report body.",
        input_schema: {
          type: "object",
          properties: {
            blocks: {
              type: "array",
              items: BLOCK_SCHEMA,
              minItems: 5,
            },
          },
          required: ["blocks"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_report" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = res.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("synthesis: no tool_use block in response");
  }
  const input = toolBlock.input as { blocks?: unknown };
  if (!Array.isArray(input.blocks)) {
    throw new Error("synthesis: blocks is not an array");
  }

  // Defensively coerce. We trust the schema validator but a stray malformed
  // block shouldn't crash rendering — drop it instead.
  const blocks: ReportBlock[] = [];
  for (const raw of input.blocks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    switch (b.kind) {
      case "paragraph":
        if (typeof b.text === "string") {
          // Accept either number[] (preferred) or number (legacy). Filter to
          // valid 1-based indices and let the renderer cap against the
          // actual reference count.
          let cites: number | number[] | undefined;
          if (Array.isArray(b.cites)) {
            cites = b.cites
              .filter((n): n is number => typeof n === "number" && n >= 1)
              .map((n) => Math.floor(n));
          } else if (typeof b.cites === "number") {
            cites = b.cites;
          }
          blocks.push({ kind: "paragraph", text: b.text, cites });
        }
        break;
      case "heading":
        if (
          typeof b.text === "string" &&
          (b.level === 2 || b.level === 3 || b.level === 4)
        ) {
          blocks.push({ kind: "heading", level: b.level, text: b.text });
        }
        break;
      case "sectionLabel":
        if (typeof b.text === "string") {
          blocks.push({ kind: "sectionLabel", text: b.text });
        }
        break;
      case "table":
        if (
          Array.isArray(b.columns) &&
          Array.isArray(b.rows) &&
          b.columns.every((c) => typeof c === "string")
        ) {
          blocks.push({
            kind: "table",
            columns: b.columns as string[],
            rows: (b.rows as unknown[]).map((row) =>
              Array.isArray(row) ? row.map((c) => String(c ?? "")) : []
            ),
          });
        }
        break;
      case "notes":
        if (Array.isArray(b.items)) {
          blocks.push({
            kind: "notes",
            title: typeof b.title === "string" ? b.title : undefined,
            items: (b.items as unknown[]).flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const it = item as Record<string, unknown>;
              if (typeof it.text !== "string") return [];
              return [
                {
                  text: it.text,
                  children: Array.isArray(it.children)
                    ? (it.children as unknown[]).flatMap((c) => {
                        if (!c || typeof c !== "object") return [];
                        const cit = c as Record<string, unknown>;
                        return typeof cit.text === "string"
                          ? [{ text: cit.text }]
                          : [];
                      })
                    : undefined,
                },
              ];
            }),
          });
        }
        break;
    }
  }

  return blocks;
}

// ---- Orchestration ---------------------------------------------------------

export type SynthesizedReport = {
  tldr: string;
  blocks: ReportBlock[];
};

export async function synthesizeReport(
  question: string,
  extraction: NonNullable<Report["extraction"]>,
  criterionText: string | null,
  action: SynthesisAction = "report"
): Promise<SynthesizedReport> {
  // Run both calls in parallel — they're independent inputs.
  const [tldr, blocks] = await Promise.all([
    generateTldr(question, extraction),
    generateBody(question, extraction, criterionText, action),
  ]);
  return { tldr, blocks };
}
