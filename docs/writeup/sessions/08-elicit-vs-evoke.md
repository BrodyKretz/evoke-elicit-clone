# Session 08 — Elicit vs Evoke (and where to diverge)

## Why this matters

We built Evoke as an Elicit-shaped skeleton to learn the problem space. The
plan now is to stop copying and ship something distinctively ours. This
session pins down what Elicit actually does today (per their public docs),
where Evoke is today, and where the meaningful divergence opportunities
are.

> Note: `elicit.com` itself returns 403 to automated fetches, but their API
> documentation site is open. The feature inventory below is from
> `docs.elicit.com` and matches the tab structure you described
> ("Workflows / Research agent / Report / Systematic review / Tools / Find
> papers / Chat with papers / Extract data").

## Elicit's product surface (today)

Elicit is structured around four "tools" that can be used standalone or
composed into bigger workflows:

| Tool | What it does | Input | Output |
|---|---|---|---|
| Find papers | Search 125M+ academic papers semantically | Natural-language query + filters (year, study type, journal quartile, PDF availability) | Paper list with title/abstract/authors/DOI/citations |
| Chat with papers | Ask follow-up questions scoped to a set of papers | Question, in context of a chosen paper set | Streaming answer that cites the papers |
| Extract data | Pull structured fields from each paper | Custom or AI-generated column definitions in plain language | CSV/XLSX table indexed by paper |
| Search clinical trials | Same as Find papers, but for ClinicalTrials.gov | Query + trial filters (phase, recruitment status) | Trial records |

These tools then combine into two "workflows":

| Workflow | What it does | Output |
|---|---|---|
| Research Agent / Report | End-to-end "ask a question, get a report" — searches, screens, extracts, summarizes | Markdown report with title/summary/body + PDF/DOCX export |
| Systematic Review (Enterprise) | Full SR pipeline with abstract screening, fulltext screening, extraction, and bibliography-formatted report | Stage-by-stage CSV/XLSX + final report |

## Evoke today

Evoke has one workflow — the Report workflow — covered by four agents and
a single home-page query box:

| Stage | Agent | Model |
|---|---|---|
| Gather | `lib/corpus/*` (S2 or CORE) | n/a |
| Screen | `lib/agents/screen.ts` — one auto-generated criterion + per-paper decision | Haiku 4.5 |
| Extract | `lib/agents/extract.ts` — auto-generated columns + per-paper extraction | Sonnet 4.6 |
| Synthesize | `lib/agents/synthesize.ts` — TLDR + structured report blocks | Opus 4.7 |
| Chat | `lib/agents/chat.ts` — scoped Q&A against the produced report | Opus 4.7 |

Tabs in the report view: `Research report`, `Extraction results`,
`Search results`, `Gather sources`. (The old `Example searches` tab was
removed this session.)

## Feature-level comparison

| Capability | Elicit | Evoke |
|---|---|---|
| Semantic search corpus | S2 + ClinicalTrials.gov (their own meta-index) | S2 *or* CORE (user-picked at submit time) |
| Auto-generated screening criterion | Yes, plus user-authored criteria + abstract + fulltext stages | Yes — single auto-generated criterion, user-editable, single stage |
| Extraction columns | User-defined OR AI-generated | AI-generated only (4 columns, hardcoded) |
| Per-cell evidence (quotes from abstract) | Yes | Yes (`CellEvidence`) |
| TL;DR / report synthesis | Markdown + PDF + DOCX export | Markdown export only |
| Citation popovers in the report | Yes | Yes (`<CiteCluster>`) |
| Chat about the report | Yes — scoped to the chosen paper set | Yes — scoped to the run; now supports the **DumDum button** (simplified rewrite of a verbose answer), prefer-grounded chat with explicit `**General background (not from your papers):**` fallback |
| Live progress UI during a run | Limited — usually shown as one progress bar | Per-stage event stream: gather → screen → extract → synthesize with live criterion + columns + TLDR surfacing |
| Editable criterion → cascade re-screen | Yes | Yes (`/rescreen` endpoint) |
| Distractor-resilient screening | Yes | Yes (rationales cite the specific gap) |
| Spelling tolerance on the query | Unknown — gracefully degrades | **Silent typo correction** on zero-gather, retries once with corrected query, surfaces the correction |
| All-excluded → graceful empty state | Unknown | Yes (this session) — finalizes with the criterion shown so the user can edit and re-screen |
| Reproducibility / fixture-based demos | Closed-source | Three hand-frozen reports in `lib/data/fixtures/` for instant-load demos without burning API spend |
| Open-source | No | Yes |

## Where Evoke already differs

These differences exist today and are net-positive — they're worth keeping
and leaning into.

1. **Corpus choice is explicit and live.** Elicit owns their corpus; Evoke
   exposes S2 vs CORE. CORE is genuinely better for open-access full-text;
   S2 has better metadata. Keeping the toggle in the UI is honest.
2. **Live per-stage event stream.** The gather view shows the auto-generated
   criterion, the extraction columns, and the TLDR as they appear. Elicit
   tends to hide this — Evoke teaching the user *how the answer was built*
   is a real differentiator, especially for skeptical academic users.
3. **Soft-empty paths.** Zero sources, no abstracts, and all-excluded
   screening each finalize gracefully with a specific tldr that points the
   user at the exact knob to turn. Elicit's failure modes feel more like
   "spinning forever or empty page."
4. **Silent typo correction on the search query.** Net-new UX: one Haiku
   call on zero-gather, retry once, surface the correction. Cheap and
   feels magic.
5. **DumDum button.** Each chat answer can be re-streamed in a
   high-schooler-readable form. Elicit assumes the user wants the dense
   academic register; we offer both.
6. **Open-source + transparent prompts.** All four agent prompts live in
   `lib/agents/*.ts`. Reviewers can audit and fork.

## Where Evoke is still copying Elicit (and shouldn't keep doing so)

1. **Single workflow.** Evoke only has the Research Agent flow. Elicit
   offers standalone Find / Chat / Extract tools too. Some Evoke users will
   want to bring their *own* papers (e.g. their lab's PDFs) and skip
   gather. We don't support that.
2. **4-column hardcoded extraction.** `COLUMN_COUNT = 4` in `extract.ts`.
   For some questions you need 6 columns; for others 3 is plenty. Elicit
   has user-editable columns. We don't.
3. **Single criterion.** Real systematic reviews use multiple inclusion +
   exclusion criteria. Evoke has one. The UI even has space for it
   (`Screening.criteria` is an array — only the first is used).
4. **No "bring your own papers" mode.** No way to upload a PDF or paste
   DOIs and skip gather. This is one of Elicit's most-used flows.
5. **Demo-driven feel.** Three frozen fixtures dominate the home page. We
   need a clearer "live runs go here" presentation as production scales.

## Concrete recommendations (sorted by impact)

### Big bets — pick one to define Evoke's wedge

- **Audit trail / explainability mode.** Lean into the live-progress
  advantage. For every claim in the synthesized report, surface the exact
  abstract phrase + paper that produced it. Elicit cites; we should
  citably-trace. This matches the academic distrust of LLMs in research
  and would justify "use Evoke for grant-prep, use Elicit for casual
  scoping."
- **Reasoning over a user's private corpus.** Add a flow where the user
  uploads 10–200 PDFs and Evoke screens / extracts / synthesizes against
  *their* set, never hitting S2/CORE. Different infra (PDF parsing,
  vector store), but it's the most-requested feature Elicit users
  publicly complain isn't great there.
- **Open eval suite.** `docs/EVAL.md` is aspirational. Actually building
  it (30 questions, gold-standard paper IDs, distractor papers, rubric
  scoring) and publishing the results gives Evoke something Elicit
  literally can't match (they won't publish numbers). This is the
  "open-source advantage" played correctly.

### Smaller, high-value polish

- **Multi-criterion screening.** Already typed as an array; extending UI
  is mostly a frontend change. Brings parity with real SR practice.
- **User-editable extraction columns.** Add a "+ Add column" affordance on
  the extraction view and a "regenerate this row" hook. Same backend
  agent, lighter UI work.
- **Bring-your-own-papers prelude.** Even before full PDF upload, accept a
  list of DOIs at submit time and skip gather. Low effort.
- **Report export → DOCX/PDF.** Markdown is OK; researchers actually share
  in DOCX/PDF. There's a markdown→DOCX library that takes an afternoon.

## What this session changed in the code

Tied to the conversation around this comparison:

- Removed the `Example searches` tab (and `components/examples/`,
  `app/report/[id]/examples/`). Production-shaped now.
- Added a row of clickable example queries on the home page.
- Made screening rationale much more visible on the search-results tab —
  color-coded chip per decision, "Why included:" label.
- Added the **DumDum button** on chat responses (new
  `lib/agents/chat.ts#simplifyText`, new
  `app/api/reports/[id]/chat/simplify/route.ts`, and per-message UI in
  `ChatPanel.tsx`).

The Elicit-parity drift Evoke should keep an eye on — multi-criterion
screening, user-editable columns, BYO papers — is itemized above.

## Open question for next session

If we pick one "big bet" from the list, which?

My read: **audit trail / explainability mode** is the highest-leverage
because it leverages strengths Evoke already has (live progress UI, open
prompts, the `evidence` quotes already attached per cell) and directly
addresses the trust gap that researchers cite about LLM-driven tools. It
also defers harder infra work (PDF parsing for BYO, formal eval rubric
building).
