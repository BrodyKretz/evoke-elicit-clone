import { anthropic, MODELS } from "@/lib/anthropic";
import type { EmitFn } from "@/lib/events";
import { pMap } from "@/lib/utils/p-map";
import type {
  Paper,
  ScreeningCriterion,
  ScreeningDecision,
  ScreeningResult,
} from "@/lib/types";

// Auto-generate ONE default inclusion criterion from the research question.
// Used when the user hasn't authored their own criteria. One Haiku call.
export async function generateCriterion(question: string): Promise<ScreeningCriterion> {
  if (!question.trim()) throw new Error("question is empty");

  const res = await anthropic().messages.create({
    model: MODELS.screening,
    max_tokens: 256,
    system:
      "You generate inclusion criteria for systematic literature reviews. Given a research question, propose ONE clear, gradeable inclusion criterion that papers should satisfy to be relevant. The criterion must be specific enough that a yes/no/maybe decision is feasible from just an abstract, aligned with the core question, and a single sentence.",
    tools: [
      {
        name: "propose_criterion",
        description: "Record the proposed inclusion criterion.",
        input_schema: {
          type: "object",
          properties: {
            criterion: {
              type: "string",
              description: "A one-sentence inclusion criterion.",
            },
          },
          required: ["criterion"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "propose_criterion" },
    messages: [{ role: "user", content: `Research question: ${question}` }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("criterion generation: no tool_use block in response");
  }
  const input = block.input as { criterion?: string };
  if (!input.criterion?.trim()) {
    throw new Error("criterion generation: empty criterion returned");
  }
  return { id: "c1", text: input.criterion.trim() };
}

// Screen one paper against one criterion. Returns a typed ScreeningResult.
// Single Haiku call with forced tool output for reliable JSON.
async function screenPaper(
  paper: Paper,
  criterion: ScreeningCriterion,
  question: string
): Promise<ScreeningResult> {
  const abstract = paper.abstract?.slice(0, 4000) ?? "(no abstract available)";

  const res = await anthropic().messages.create({
    model: MODELS.screening,
    max_tokens: 400,
    system:
      "You are a research-paper screener for a systematic literature review. Given a research question, an inclusion criterion, and a paper's title + abstract, decide whether the paper should be included for further analysis.\n\nReturn your decision with the `record_decision` tool:\n- `include` — directly addresses the question and meets the criterion\n- `exclude` — off-topic or clearly fails the criterion\n- `maybe` — borderline; full text would be needed to decide\n\nProvide a single-sentence rationale that cites the specific aspect of the abstract that drove your decision.",
    tools: [
      {
        name: "record_decision",
        description: "Record the screening decision for this paper.",
        input_schema: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["include", "exclude", "maybe"],
              description: "The screening decision.",
            },
            rationale: {
              type: "string",
              description: "One sentence justifying the decision.",
            },
          },
          required: ["decision", "rationale"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_decision" },
    messages: [
      {
        role: "user",
        content: `Research question: ${question}\n\nInclusion criterion: ${criterion.text}\n\nPaper:\nTitle: ${paper.title}\nAbstract: ${abstract}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(`screening: no tool_use block for paper ${paper.id}`);
  }
  const input = block.input as { decision?: string; rationale?: string };
  const decision = input.decision as ScreeningDecision | undefined;
  if (!decision || !["include", "exclude", "maybe"].includes(decision)) {
    throw new Error(`screening: invalid decision "${input.decision}" for paper ${paper.id}`);
  }
  return {
    paperId: paper.id,
    criterionId: criterion.id,
    decision,
    rationale: input.rationale?.trim() ?? "",
  };
}

// Screen many papers against one criterion. Bounded concurrency keeps us under
// Anthropic's rate limit. Failed papers are skipped — one bad call shouldn't
// kill the whole batch.
export async function screenPapers(
  papers: Paper[],
  criterion: ScreeningCriterion,
  question: string,
  concurrency = 3,
  onEvent?: EmitFn
): Promise<ScreeningResult[]> {
  if (papers.length === 0) return [];

  let done = 0;
  const settled = await pMap(papers, concurrency, async (paper) => {
    try {
      const r = await screenPaper(paper, criterion, question);
      done++;
      onEvent?.({ type: "progress", stage: "screen", done, total: papers.length });
      return r;
    } catch (err) {
      done++;
      onEvent?.({ type: "progress", stage: "screen", done, total: papers.length });
      console.error(`screening failed for ${paper.id}:`, err);
      return null;
    }
  });

  return settled.filter((r): r is ScreeningResult => r !== null);
}
