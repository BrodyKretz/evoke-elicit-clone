// Chat agent — answers user follow-up questions about a completed run.
//
// Scope policy (prefer-grounded with labeled fallback):
//   The model answers from the gathered/screened/extracted data and synthesized
//   report whenever possible. For definitional or background questions related
//   to the research topic that the papers don't cover, it may use general
//   knowledge but MUST prefix the answer with "**General background (not from
//   your papers):**" so the user knows the source. Off-topic questions
//   (weather, sports, unrelated subjects) are still declined.

import { anthropic, MODELS } from "@/lib/anthropic";
import type { Report } from "@/lib/types";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT_HEADER = `You are an AI research assistant scoped to a single Evoke research run. You help the user analyze and understand the studies in their current results table.

You can:
- Answer questions about the studies in the results
- Compare findings across different papers
- Explain methodologies, outcomes, conclusions, and limitations of the papers
- Synthesize information across multiple studies
- Help the user understand the synthesized report
- Provide general background or definitions related to the research question when the papers below don't cover them. When you do, you MUST prefix that part of your answer with the exact label "**General background (not from your papers):**" on its own line so the user can tell what came from the run vs. your general knowledge.

You cannot:
- Discuss topics unrelated to the research question. If the user asks something off-topic (weather, sports, unrelated subjects), say so clearly ("I can only help with questions related to your current research") and offer to help with something in scope.
- Make up data not present in the extraction table or paper abstracts. Never present invented findings as if they came from the papers.
- Cite papers not in the references list.

Always prefer information from the papers below. Use general background knowledge only when the papers don't address the question, and always label it as instructed above. When citing papers, use the 1-based index given in the paper list (e.g. "Paper [3]").

Be concise. Quote short phrases from abstracts when they support a claim.`;

function formatPapersForPrompt(report: Report): string {
  const refs = report.references ?? [];
  if (refs.length === 0) return "(no papers attached to this run)";
  return refs
    .map((p, i) => {
      const authors =
        p.authors.length > 4
          ? `${p.authors.slice(0, 4).join(", ")} et al.`
          : p.authors.join(", ");
      const abstract = p.abstract?.slice(0, 1500) ?? "(abstract not available)";
      return `[${i + 1}] ${authors} (${p.year || "n.d."}). ${p.title}${
        p.journal ? ` — ${p.journal}` : ""
      }.\n    Abstract: ${abstract}`;
    })
    .join("\n\n");
}

function formatExtractionForPrompt(report: Report): string {
  const ext = report.extraction;
  if (!ext) return "(no extraction table for this run)";
  const header = `Columns: ${ext.columns.join(" | ")}`;
  const rows = ext.rows
    .map((r, i) => {
      const cells = r.cells.map((c) => c.replaceAll("\n", " ").slice(0, 300));
      return `[${i + 1}] ${cells.join(" | ")}`;
    })
    .join("\n");
  return `${header}\n${rows}`;
}

function formatReportForPrompt(report: Report): string {
  const blocks = report.report;
  if (!blocks?.length) return "(no synthesized report for this run)";
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "sectionLabel":
          return `## ${b.text}`;
        case "heading":
          return `${"#".repeat(b.level)} ${b.text}`;
        case "paragraph":
          return b.text;
        case "table": {
          // Render rows inline (cells truncated) so the chat agent can actually
          // answer per-row questions. The fixture demos store most data here.
          const header = b.columns.join(" | ");
          const rows = b.rows
            .map(
              (row) =>
                "- " +
                row
                  .map((c) => c.replaceAll("\n", " ").slice(0, 200))
                  .join(" | ")
            )
            .join("\n");
          return `Table — ${header}\n${rows}`;
        }
        case "notes":
          return `${b.title ?? "Notes"}:\n${b.items
            .map((i) => {
              const childLines = i.children
                ? i.children.map((c) => `    - ${c.text}`).join("\n")
                : "";
              return `- ${i.text}${childLines ? `\n${childLines}` : ""}`;
            })
            .join("\n")}`;
      }
    })
    .join("\n\n");
}

export function buildChatSystemPrompt(report: Report): string {
  return [
    SYSTEM_PROMPT_HEADER,
    "",
    `Research question: ${report.question}`,
    "",
    `Synthesized report's TLDR: ${report.tldr}`,
    "",
    "=== PAPERS ===",
    formatPapersForPrompt(report),
    "",
    "=== EXTRACTION TABLE ===",
    formatExtractionForPrompt(report),
    "",
    "=== SYNTHESIZED REPORT ===",
    formatReportForPrompt(report),
  ].join("\n");
}

// Rewrite an assistant response in plain language for a smart high-schooler.
// Used by the "DumDum" button on each chat response — keeps Paper [N]
// citations exactly, cuts jargon, shortens.
export async function simplifyText(
  text: string,
  onChunk: (text: string) => void
): Promise<string> {
  const system =
    "You rewrite dense research-assistant answers into a short, clear explanation a smart high-schooler could grok in 30 seconds.\n\nRULES:\n- Cut HARD. Aim for roughly HALF the original length. Strip per-study minutiae, hedges, and tangents.\n- Lead with the bottom-line answer in one or two sentences.\n- Use plain language. Replace jargon when you can; if a term is essential, define it briefly.\n- Short sentences. Active voice. Prefer prose to long bullet lists.\n- KEEP any 'Paper [N]' citations exactly as written. KEEP precise numbers/sample sizes only when they directly support the bottom line.\n- Do NOT add disclaimers, 'I' statements, or meta commentary about simplifying.\n- If the original is already short and simple, return a near-verbatim copy.";

  let full = "";
  const stream = anthropic().messages.stream({
    model: MODELS.screening, // Haiku — fast and cheap for rewriting
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: text }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full += event.delta.text;
      onChunk(event.delta.text);
    }
  }
  return full;
}

// Run a chat turn. Streams the response back to the caller chunk-by-chunk.
// `onChunk` receives incremental text; resolve on full message.
export async function chat(
  report: Report,
  history: ChatMessage[],
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  const system = buildChatSystemPrompt(report);

  // Build the API messages — alternate user/assistant, with the new user
  // message appended. Anthropic requires the first message to be `user`.
  const apiMessages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  let full = "";

  const stream = anthropic().messages.stream({
    model: MODELS.synthesis, // Opus 4.7 — quality for cross-paper reasoning
    max_tokens: 2048,
    system,
    messages: apiMessages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  return full;
}
