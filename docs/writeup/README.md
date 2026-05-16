# Writeup outline

A working draft of the eventual blog post documenting how Evoke was built.

Structure mirrors Shlok's [OpenPoke writeup](https://www.shloked.com/writing/openpoke):
narrative arc from "what is this product?" → architecture → memory/state →
"how it all fits" → shortcomings → takeaways for builders.

Each numbered file is a section. Fill in as we build. By the time the agent
layer is done, this folder should be ~80% of a publishable post.

## Sections

0. [Introduction](00-introduction.md) — What Elicit is and why we're cloning it.
1. [What is Evoke?](01-what-is-evoke.md) — Scope and explicit limitations.
2. [Architecture overview](02-architecture-overview.md) — High-level pipeline.
3. [Gather sources](03-gather-sources.md) — Semantic retrieval at 1k-paper scale.
4. [Screen sources](04-screen-sources.md) — LLM screening criteria.
5. [Extract data](05-extract-data.md) — Per-paper structured extraction.
6. [Generate report](06-generate-report.md) — Synthesis with citations.
7. [How it all fits together](07-how-it-fits-together.md) — End-to-end sequence diagram.
8. [Where Evoke falls short](08-shortcomings.md) — Honest limitations.
9. [Takeaways for builders](09-takeaways.md) — Generalizable lessons.

## Working principles for the writeup

Borrowing from Shlok's piece, which I want to feel like:

- **Narrative examples recur throughout.** One research question (probably the
  Lennox-Gastaut biomarkers example, since we have it deep) gets walked through
  each pipeline stage so the reader has a concrete thread.
- **Diagrams, not code.** Architecture overviews, sequence flows. Code lives in
  the repo, linked at start and end.
- **Intermediate accessibility.** No assumption of systems-design background;
  enough detail for engineers to understand decisions.
- **Honest about shortcomings.** A "where it falls short" section is required.
