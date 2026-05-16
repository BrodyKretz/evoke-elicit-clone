import { anthropic, MODELS } from "@/lib/anthropic";

// Silent query normalizer. Used when a gather call returns zero papers — we
// suspect a typo and ask Haiku for a corrected version to retry with. Designed
// to be conservative: returns null when the query already looks correct or
// when the "correction" would be a synonym swap rather than a typo fix.

export async function suggestCorrectedQuery(question: string): Promise<string | null> {
  const trimmed = question.trim();
  if (!trimmed) return null;

  const res = await anthropic().messages.create({
    model: MODELS.screening, // Haiku — fast + cheap
    max_tokens: 200,
    system:
      "You correct typos and obvious misspellings in research-search queries so they better match what's in academic databases (Semantic Scholar, CORE, PubMed). Be CONSERVATIVE:\n- Only fix clear typos and misspellings (e.g. 'tourretts' → 'Tourette syndrome', 'alzheimrs' → 'Alzheimer's').\n- Do NOT rephrase, expand, summarize, or change the meaning.\n- Do NOT correct valid domain terms or acronyms (e.g. 'ALS', 'PD-L1', 'CRISPR-Cas9') even if they look unusual.\n- If the query already looks fine, set `corrected` to null.\n\nReturn via the `record_correction` tool.",
    tools: [
      {
        name: "record_correction",
        description: "Record the corrected query, or null if no correction is needed.",
        input_schema: {
          type: "object",
          properties: {
            corrected: {
              type: ["string", "null"],
              description:
                "The corrected query string. Null if the original looks correct.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description:
                "How confident the model is that the correction is what the user meant.",
            },
          },
          required: ["corrected", "confidence"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_correction" },
    messages: [{ role: "user", content: `Query: ${trimmed}` }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const input = block.input as { corrected?: string | null; confidence?: string };

  if (input.corrected == null) return null;
  const corrected = typeof input.corrected === "string" ? input.corrected.trim() : "";
  if (!corrected) return null;
  // Don't retry with an effectively-identical string (case/whitespace only).
  if (corrected.toLowerCase() === trimmed.toLowerCase()) return null;
  // Skip low-confidence "corrections" — they're usually rephrasing, not typo fixes.
  if (input.confidence === "low") return null;

  return corrected;
}
