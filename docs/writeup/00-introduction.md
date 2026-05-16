# Introduction

Elicit is one of the cleanest examples I know of "an agent over documents" as a real, paid, valued product. Researchers use it to read papers they otherwise couldn't, at a scale a single human couldn't sustain. The 30-second pitch: paste a research question in English → get back a structured systematic review with a few dozen papers, a typed data table, and a citation-anchored narrative summary.

Internally, the product is a **four-stage pipeline**:

1. **Gather** — semantically search a corpus of papers for the ones likely to be relevant.
2. **Screen** — for each candidate, LLM-judge whether it actually meets a stated inclusion criterion.
3. **Extract** — for each kept paper, LLM-fill a structured table of fields the user cares about.
4. **Synthesize** — assemble a narrative report over the extraction, with tables and inline cites.

Each stage funnels: ~10M papers → top-1000 candidates → ~30 kept → one report.

The interesting design property is that **each stage has a different cost profile** and uses a different model accordingly. A purely-LLM pipeline at the front of the funnel would be ruinously expensive; a purely-embedding pipeline at the end would lose all the reasoning that makes the final report worth reading.

## Why an open-source clone

Three reasons:

1. **The composition is the magic, not any one component.** Embedding search isn't novel. LLM extraction isn't novel. The way Elicit chains them into a research-shaped artifact *is* novel. That composition is worth open-sourcing.
2. **Researcher use cases want auditability.** When you're going to publish a literature review whose underlying selection was AI-mediated, "trust us" doesn't fly. An open implementation makes the screening prompts, the extraction columns, and the synthesis structure inspectable.
3. **Builder education.** Building a real "agent over documents" worked example is a much more useful learning artifact than another chatbot demo. The interesting problems — cost shaping, structured output, intermediate provenance, cross-stage data contracts — only show up at this kind of compositional scale.

This writeup walks through what I built (called **Evoke**), what surprised me, where I'd do it differently, and what the resulting design teaches about building agents over piles of documents.

The accompanying repository: *[link goes here when published]*.
Inspiration for the style: [Shlok's OpenPoke writeup](https://www.shloked.com/writing/openpoke).
