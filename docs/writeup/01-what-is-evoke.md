# What is Evoke?

Evoke is an open-source clone of [Elicit](https://elicit.com)'s research-report workflow. Given a research question phrased in plain English, it produces a citation-anchored systematic review by chaining four specialized agents over the Semantic Scholar corpus.

## The product surface

Five interface screens, mirroring Elicit's one-to-one:

- **Research report** — the final synthesized output. TLDR sentence, abstract paragraphs with inline citations, summary tables, a "summary statistics" notes block aggregating across papers, and a conclusion.
- **Extraction results** — the per-paper data table the synthesis was built from. Four LLM-chosen columns tailored to the research question; each cell carries inline quoted phrases from the abstract as evidence.
- **Search results** — the screened paper list. Each paper has an include/maybe/exclude badge with an LLM-written rationale on hover. The auto-generated screening criterion shown above the list is editable; editing triggers a full cascade re-run.
- **Gather sources** — for in-flight runs, a live event stream from each pipeline stage. For completed runs, the original ranked candidate list from Semantic Scholar.
- **Example searches** — three baked-in fixtures demonstrating each pipeline state (complete report / mid-search / mid-gather).

Plus a sidebar that's always visible while looking at a run:

- **Pipeline status** — which of the four stages have completed, with per-stage metadata (sources found / sources included / data points extracted).
- **Chat with this report** — an AI assistant scoped strictly to the run's data. Answers questions about the studies, compares findings, explains methodology, but politely declines anything outside the run.
- **Download .md** — exports the synthesized report as portable Markdown with proper citation footnotes and a references section.

## What it does (the long version)

A run goes through four stages, each with a different cost profile:

1. **Gather** — hit the Semantic Scholar API for the top ~25 candidates ranked by S2's own relevance signal. Map the responses into a typed `Paper` shape; drop ones without abstracts (downstream stages need them).
2. **Screen** — autogenerate a one-sentence inclusion criterion from the question. Then for each paper, fire a Haiku 4.5 call that returns `{decision: include|exclude|maybe, rationale}`. Bounded parallelism, ~5 seconds total for 25 papers. Bad calls degrade to "no decision" rather than failing the run.
3. **Extract** — generate exactly 4 column headers tailored to the question (one specifically aligned to the question's intent). Then for each included or maybe paper, fire a Sonnet 4.6 call that returns `{value, quotes}` per column. The quotes are short verbatim phrases from the abstract — they appear in the UI as expandable evidence under each cell.
4. **Synthesize** — two parallel Opus 4.7 calls. One produces a single-sentence TLDR. The other emits a structured `ReportBlock[]` (section labels / headings / paragraphs / tables / notes) with paragraphs carrying paper-index citation arrays. The UI renders these blocks as the canonical Elicit-style report.

After the run completes, the user can:

- **Edit the screening criterion and cascade.** Click "Edit & re-screen" on the criterion card, type a new criterion, click Apply. The pipeline re-runs from stage 2 onwards (reusing the existing gathered papers, no S2 call), the user lands on the live-progress view to watch the cascade, and the new report replaces the old one.
- **Chat with the report.** Ask follow-up questions in natural language. The chat model has the full run context (papers, extraction, synthesis) but is scoped to that data — questions outside it are declined.
- **Download.** Export the report as Markdown for citation in a paper, a blog post, or a Notion doc.

## What it explicitly is not

- Not an open-ended agentic chatbot. The pipeline is code-orchestrated; each stage is a specific LLM call with a specific prompt and a specific schema. The only place an open-ended agent loop runs is the chat sidebar, and even there it's strictly scoped to the run's data.
- Not a search engine. The relevance ranking happens at Semantic Scholar; Evoke is the "agent over those results" layer.
- Not a chat-with-the-internet tool. Evoke deliberately can't draw on broader knowledge — both for cost reasons and because researcher use cases want a clear evidence trail.

## Scope explicitly *not yet* in this build

- Full-text PDF retrieval (currently abstract-only).
- 1000-paper scale (currently top-25 — architecture supports the bigger number; rate limits and cost haven't been tuned).
- Real evaluation benchmarks (`docs/EVAL.md` outlines the plan).
- User auth or multi-user persistence (single-developer dev setup with a JSON file store).

These are all discussed in detail in *Where Evoke falls short*.

## Where the inspiration ends

Evoke deliberately picks Elicit's UI conventions wholesale — the cream-and-teal palette, the Manrope/Fraunces typography, the 5-tab layout, the structured-table-as-research-artifact aesthetic. The implementation is independent: every prompt, every agent, every typed schema was written from scratch. None of Elicit's internals are reproduced — they're guessed-at from the visible product behavior and the published rate at which Elicit reports get generated.
