import { anthropic, MODELS } from "@/lib/anthropic";

// Query expander. Takes the user's research question and proposes 1-3
// additional search-engine queries that, together with the original, give
// the gather stage a wider net. Keeps the original query first.
//
// Why this exists: semantic search corpora (S2/CORE) return one ranked list
// per query, and a single phrasing misses adjacent literature. Elicit's
// research agent runs 5+ parallel searches and benefits from the union of
// hits. This is the cheapest version of that — one Haiku call to ideate
// variants, then parallel searchPapers calls in pipeline.ts.

export type ExpandedQuery = {
  /** The original user query, always returned first. */
  original: string;
  /** Up to 3 additional phrasings that hit adjacent literature. May be empty. */
  variants: string[];
};

export async function expandQuery(question: string): Promise<ExpandedQuery> {
  const trimmed = question.trim();
  if (!trimmed) return { original: "", variants: [] };

  const res = await anthropic().messages.create({
    model: MODELS.screening, // Haiku — cheap and fast
    max_tokens: 400,
    system:
      "You expand a research question into a few additional search queries that hit adjacent literature. Goal: surface papers the original phrasing might miss. \n\nGUIDELINES:\n- Return 1-3 variants. Fewer is fine; you don't have to fill all slots.\n- Each variant should be SHORT (a search-engine phrase, not a sentence) and use different keywords than the original.\n- Cover at least one of: a different angle (mechanism vs clinical), a clinical-trial-specific phrasing (mention 'trial' / 'phase'), or a synonym shift (e.g., a specific drug class).\n- Skip variants that just paraphrase. Skip when the original is already very narrow.\n- Do NOT add quotes or boolean operators.\n\nReturn via the `propose_variants` tool.",
    tools: [
      {
        name: "propose_variants",
        description: "Record additional search query variants.",
        input_schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
              description: "1-3 alternative search queries.",
            },
          },
          required: ["variants"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "propose_variants" },
    messages: [{ role: "user", content: `Research question: ${trimmed}` }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return { original: trimmed, variants: [] };
  const input = block.input as { variants?: unknown };
  if (!Array.isArray(input.variants)) return { original: trimmed, variants: [] };

  const variants = input.variants
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.toLowerCase() !== trimmed.toLowerCase())
    .slice(0, 3);

  return { original: trimmed, variants };
}
