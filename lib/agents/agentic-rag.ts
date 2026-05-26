import { anthropic, MODELS } from "@/lib/anthropic";
import { searchPapers, getReferences, type CorpusProvider } from "@/lib/corpus";
import { saveRun } from "@/lib/store";
import { emit, makeEmitter } from "@/lib/events";
import type { Paper, Report } from "@/lib/types";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_ITERATIONS = 8;
const SOFT_LIMIT_AT = 6;
const ABSTRACT_TRUNCATE = 1500;

const SYSTEM_PROMPT = `You are an agentic research assistant. The user gives you a research question. You have tools to search an academic paper corpus, chase a paper's references, and finalize an answer.

GOAL: build up a working set of relevant papers ACROSS MULTIPLE search iterations, then synthesize a cited answer. Don't do one search and stop — refine your queries based on what each round of abstracts reveals.

WORKFLOW:
1. Start with a broad search using the user's question (or a lightly rephrased version).
2. Read the returned abstracts. Look for clusters, recurring terminology, specific subtopics, or named methods/molecules/interventions worth narrowing into.
3. Run targeted follow-up searches. Each one should be meaningfully DIFFERENT — narrower, broader, or pivoting to a related subtopic. Vary the query language.
4. When a paper looks foundational (high citations, seminal terminology), chase its references with get_references.
5. Once you have enough evidence to answer — typically 8-20 unique papers spanning the question — call finalize.

NARRATION (important):
- BEFORE each tool call, write one or two short sentences explaining what you're about to do and why. The user is watching your reasoning live.
- AFTER seeing tool results, write a short observation about what you found and what you'll do next.
- Keep prose tight. No headers, no bullet lists in your narration — just plain sentences.

DISCIPLINE:
- Don't repeat near-identical searches. Vary terminology.
- ${MAX_ITERATIONS} iterations maximum. Plan to call finalize by iteration ${SOFT_LIMIT_AT}.
- Cite papers by their paper_id (the long alphanumeric string in each result).

FINALIZE FORMAT:
- "answer" is a markdown-formatted synthesis (2-5 paragraphs). Inline citations as [[paper_id]] right after the claim they support.
- "cited_ids" is the deduplicated list of paper_ids you referenced inline.`;

type Tool = NonNullable<Anthropic.Messages.MessageCreateParams["tools"]>[number];

const TOOLS: Tool[] = [
  {
    name: "search_papers",
    description:
      "Search the academic corpus for papers matching a natural-language query. Returns top-N papers with titles, authors, year, citation count, and full abstracts.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query." },
        limit: {
          type: "integer",
          minimum: 3,
          maximum: 25,
          description: "Max papers to return. Default 10.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_references",
    description:
      "Fetch the papers cited by a given paper (its reference list). Use this to chase foundational/seminal work after spotting a high-citation paper in search results.",
    input_schema: {
      type: "object",
      properties: {
        paper_id: {
          type: "string",
          description: "A paper_id returned by a previous search_papers call.",
        },
        limit: {
          type: "integer",
          minimum: 3,
          maximum: 25,
          description: "Max references to return. Default 10.",
        },
      },
      required: ["paper_id"],
    },
  },
  {
    name: "finalize",
    description:
      "End the run with the final synthesized answer. Only call this once you have enough evidence to answer the question.",
    input_schema: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description:
            "Markdown-formatted synthesis (2-5 paragraphs) with inline [[paper_id]] citations placed right after the claims they support.",
        },
        cited_ids: {
          type: "array",
          items: { type: "string" },
          description: "Deduplicated list of paper_ids referenced in the answer.",
        },
      },
      required: ["answer", "cited_ids"],
    },
  },
];

function formatPaperForAgent(p: Paper): string {
  const authors =
    p.authors.length > 3 ? `${p.authors.slice(0, 3).join(", ")} et al.` : p.authors.join(", ");
  const abstract = (p.abstract ?? "").slice(0, ABSTRACT_TRUNCATE);
  const cites = typeof p.citations === "number" ? ` · ${p.citations} citations` : "";
  return `paper_id: ${p.id}\n${p.title} — ${authors} (${p.year || "n.d."})${cites}\n${
    abstract || "(no abstract available)"
  }`;
}

type FinalizeInput = { answer: string; cited_ids: string[] };

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  corpus: CorpusProvider,
  workingSet: Map<string, Paper>
): Promise<{ summary: string; content: string; added: number }> {
  if (name === "search_papers") {
    const query = String(input.query ?? "").trim();
    const limit = Math.min(25, Math.max(3, Number(input.limit ?? 10)));
    if (!query) {
      return { summary: "empty query", content: "Error: empty query.", added: 0 };
    }
    const papers = await searchPapers(corpus, query, limit);
    let added = 0;
    for (const p of papers) {
      if (!workingSet.has(p.id)) {
        workingSet.set(p.id, p);
        added++;
      }
    }
    const summary = `"${query}" → ${papers.length} papers (${added} new)`;
    const content =
      papers.length === 0
        ? `No papers found for "${query}". Try different terminology.`
        : papers.map(formatPaperForAgent).join("\n\n---\n\n");
    return { summary, content, added };
  }

  if (name === "get_references") {
    const paperId = String(input.paper_id ?? "").trim();
    const limit = Math.min(25, Math.max(3, Number(input.limit ?? 10)));
    if (!paperId) {
      return { summary: "missing paper_id", content: "Error: paper_id required.", added: 0 };
    }
    const papers = await getReferences(paperId, limit);
    let added = 0;
    for (const p of papers) {
      if (!workingSet.has(p.id)) {
        workingSet.set(p.id, p);
        added++;
      }
    }
    const sourceTitle = workingSet.get(paperId)?.title?.slice(0, 60) ?? paperId.slice(0, 12);
    const summary = `refs of "${sourceTitle}" → ${papers.length} (${added} new)`;
    const content =
      papers.length === 0
        ? "No references returned (paper may not have a reference list in the corpus)."
        : papers.map(formatPaperForAgent).join("\n\n---\n\n");
    return { summary, content, added };
  }

  return { summary: `unknown tool: ${name}`, content: `Unknown tool: ${name}`, added: 0 };
}

export async function runAgenticRag(runId: string, question: string, initial: Report) {
  const onEvent = makeEmitter(runId);
  const corpus: CorpusProvider = initial.corpus ?? "s2";
  const workingSet = new Map<string, Paper>();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `Research question: ${question}` },
  ];

  let finalAnswer: FinalizeInput | null = null;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    onEvent({ type: "agent.iteration", n: iteration });

    let response: Anthropic.Messages.Message;
    try {
      response = await anthropic().messages.create({
        model: MODELS.synthesis,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "anthropic call failed";
      emit(runId, { type: "error", error: `agent: ${msg}` });
      saveRun({ ...initial, tldr: `Agentic run failed: ${msg}` });
      return;
    }

    // Emit any narration text the model produced this turn.
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        onEvent({ type: "agent.thought", text: block.text.trim() });
      }
    }

    // Append assistant turn to history.
    messages.push({ role: "assistant", content: response.content });

    // No tool use → the model decided to stop without finalizing. Treat last
    // text as the answer to avoid losing work.
    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      const fallbackText = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      finalAnswer = {
        answer: fallbackText || "(no answer produced)",
        cited_ids: [],
      };
      break;
    }

    // Detect finalize. Execute non-finalize tools first; if finalize is in
    // this turn we still execute it and exit after.
    const finalizeCall = toolUses.find((t) => t.name === "finalize");
    const otherCalls = toolUses.filter((t) => t.name !== "finalize");

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of otherCalls) {
      onEvent({
        type: "agent.tool_call",
        name: call.name,
        input: call.input as Record<string, unknown>,
      });
      const res = await executeTool(
        call.name,
        call.input as Record<string, unknown>,
        corpus,
        workingSet
      );
      onEvent({ type: "agent.tool_result", name: call.name, summary: res.summary });
      if (res.added > 0) {
        onEvent({ type: "agent.working_set", total: workingSet.size, added: res.added });
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: res.content,
      });
    }

    if (finalizeCall) {
      const fi = finalizeCall.input as FinalizeInput;
      const citedIds = Array.isArray(fi.cited_ids) ? fi.cited_ids : [];
      const citedPapers = citedIds
        .map((id) => workingSet.get(id))
        .filter((p): p is Paper => Boolean(p))
        .map((p) => ({
          id: p.id,
          title: p.title,
          authors: p.authors,
          year: p.year,
          doi: p.doi,
        }));
      onEvent({
        type: "agent.finalize",
        answer: fi.answer ?? "",
        citedIds,
        citedPapers,
      });
      finalAnswer = { answer: fi.answer ?? "", cited_ids: citedIds };
      break;
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    // Soft-limit nudge — appended as a user-role system reminder.
    if (iteration === SOFT_LIMIT_AT) {
      messages.push({
        role: "user",
        content: `[System: ${
          MAX_ITERATIONS - iteration
        } iteration(s) remain. Wrap up with finalize on the next turn unless you genuinely need one more search.]`,
      });
    }
  }

  // ---- Persist ------------------------------------------------------------
  if (!finalAnswer) {
    finalAnswer = {
      answer: "Run hit the iteration cap without producing a final synthesis.",
      cited_ids: [],
    };
  }

  const citedPapers: Paper[] = finalAnswer.cited_ids
    .map((id) => workingSet.get(id))
    .filter((p): p is Paper => Boolean(p));

  const report: Report = {
    ...initial,
    tldr: extractTldr(finalAnswer.answer),
    report: [
      { kind: "sectionLabel", text: "Answer" },
      { kind: "paragraph", text: finalAnswer.answer, cites: [] },
    ],
    references: citedPapers,
    gatheredSources: Array.from(workingSet.values()),
    initialView: "report",
    status: {
      gather: { done: true, sourcesFound: workingSet.size },
      screen: { done: true, sourcesIncluded: workingSet.size },
      extract: { done: true, dataPointsExtracted: citedPapers.length },
      generate: { done: true },
    },
  };

  saveRun(report);
  onEvent({ type: "complete" });
}

function extractTldr(answer: string): string {
  // Take the first sentence (or first 240 chars) as the tldr.
  const cleaned = answer.replace(/\[\[[^\]]+\]\]/g, "").trim();
  const firstSentence = cleaned.match(/^[^.!?]+[.!?]/);
  if (firstSentence) return firstSentence[0].trim();
  return cleaned.slice(0, 240);
}
