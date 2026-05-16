# Session 07 — Eval and tuning pass

## Goal

Evaluate the effectiveness of the current Evoke pipeline by running the existing
smoke tests, inspecting output quality against the live API (Anthropic + CORE),
identifying weak spots, and making targeted tunes. This is not a full benchmark
— `docs/EVAL.md` is still outlined-but-not-built — but a structured pass over
what *is* testable today.

## Environment

- `ANTHROPIC_API_KEY` present
- `CORE_API_KEY` present (so gather can run without 429-ing on S2)
- Models in use: Haiku 4.5 (screening), Sonnet 4.6 (extraction), Opus 4.7 (synthesis + chat)
- Date: 2026-05-13

## Test surface

Five smoke scripts plus the chat agent. Created one new script
(`test-chat-edges.ts`) for harder chat probes.

| Script | What it exercises | Inputs |
|---|---|---|
| `test-chat.ts` | Chat baseline: in-run, background, off-topic | full LGS fixture |
| `test-chat-edges.ts` (new) | Definitional, mixed, clinical, soft-off-topic | full LGS fixture |
| `test-screening.ts` | Criterion generation + screening | prostate-cancer fixture |
| `test-extraction.ts` | Column generation + per-paper extraction | prostate-cancer fixture |
| `test-synthesis.ts` | Report synthesis | prostate-cancer hand-written extraction |
| `test-sse.ts` | End-to-end live run + SSE streaming | requires `npm run dev` (not run) |

`test-sse.ts` was skipped — needs the dev server running and adds limited
diagnostic value vs. the agent-level tests.

The full eval-runner bootstrap (per `docs/EVAL.md`) was deferred. Building the
benchmark fixtures + scoring code is a multi-day undertaking and would have
crowded out the actual quality review.

---

## Results

### 1. Screening (`test-screening.ts`)

Quality: **strong**. 4 papers in **2.5s** total.

- Auto-criterion generated from the question:
  > "Studies must evaluate the efficacy of specific molecular targets or
  > targeted therapies in treating metastatic neuroendocrine prostate cancer
  > or its variants in patients who have progressed on or failed androgen
  > deprivation therapy."
- 1 INCLUDE, 2 MAYBE, 1 EXCLUDE — distribution looks calibrated, not
  optimistically lenient.
- Each rationale cited a specific aspect of the abstract (e.g., the EXCLUDE
  for the P450 paper called out "does not specifically address neuroendocrine
  prostate cancer or its variants").
- The MAYBE rationales correctly flagged "abstract does not explicitly report
  efficacy data" — i.e., the model is honestly distinguishing topical match
  from evidentiary match.

No tunes needed for screening.

### 2. Extraction (`test-extraction.ts`)

Quality: **strong**. 4 columns × 4 papers in **12.4s**.

- Generated columns: *Study Methodology*, *Patient Population*,
  *Molecular Target & Intervention*, *Treatment Efficacy Outcomes*.
- The question-tailored column ("Molecular Target & Intervention") nicely
  captures the user's specific intent.
- Cells are concise and use bullets where multiple targets are present.
- "Not reported in abstract" is used honestly when efficacy outcomes aren't
  in the abstract (paper 4) — no fabrication.

No tunes needed for extraction. The `COLUMN_COUNT = 4` cap could become
limiting for some questions, but it isn't biting on this one.

### 3. Synthesis (`test-synthesis.ts`)

Quality: **strong**. TLDR + 10-block body in **20.3s** (Opus 4.7, `effort: high`).

- TLDR names specific drugs (alisertib, GSK126) — verified those appear in
  the fixture's extraction, so no fabrication.
- Body follows the prescribed Abstract → Results → Summary structure.
- Cite arrays (`cites: [1,2,3,4]`) are populated for the synthesizing
  paragraphs and empty where appropriate.
- The model correctly contrasts NEPC-specific targets (AURKA, EZH2) against
  broader CRPC targets (CYP17, EGFR) — that's the *useful* synthesis the
  question asked for, not just enumeration.
- Notes block aggregates designs and sample sizes across papers.

No tunes needed for synthesis.

### 4. Chat — baseline (`test-chat.ts`)

Initial run: 3/3 pass.

But: when the model was asked **"Which paper had the largest sample size and
what did it find?"** it replied:

> "The extraction table for this run is empty… abstracts for the 10 papers
> were not provided to me, so I don't have sample sizes or detailed
> findings to compare."

That's wrong from the user's perspective — the report blocks visible in the
UI contain a Study Characteristics table with population sizes for every
paper. The chat agent just couldn't see them.

**Root cause** (see `lib/agents/chat.ts`, `formatReportForPrompt`):

```ts
case "table":
  return `[table: ${b.columns.join(" | ")}; ${b.rows.length} rows]`;
```

Synthesized-report tables were rendered as **header + row count only** — the
actual cell data was discarded. For fixtures like Lennox-Gastaut where most
data lives in those report tables (no `extraction` field), this means the
chat agent was effectively blind to the bulk of the report's content.

### 5. Chat — edge probes (`test-chat-edges.ts`)

| Case | Expectation | Result |
|---|---|---|
| Definitional ("What does GPFA stand for…") | Use background label | ✓ Pass |
| Mixed ("Compare HRV to EEG findings, and explain HRV") | Cite + label | ✓ Pass |
| Clinical ("Which to monitor in newly diagnosed pediatric LGS") | Pure in-run | ⚠ Pass-with-asterisk |
| Off-topic ("Who won the 2024 World Series?") | Decline | ✓ Pass |
| Soft off-topic ("Fun pizza topping?") | Decline | ✓ Pass |

The clinical-recommendation case used the `**General background (not from
your papers):**` label for a "not personalized medical advice" disclaimer at
the top of the response, then synthesized the rest from the run. That's
actually *better* UX than what the strict test expected: the model
self-policed against giving individual-patient advice, then grounded the
recommendation in run data. I marked this as a passing-with-asterisk rather
than tightening the prompt to exclude scope disclaimers — felt like the
wrong direction.

---

## Tunes applied

### Tune 1 — `chat.ts` `formatReportForPrompt` renders table rows inline

`lib/agents/chat.ts`

Replaced the placeholder `[table: cols; N rows]` rendering with actual row
rendering (cells truncated to 200 chars), and added child rendering for
`notes` blocks so nested bullets aren't dropped.

```ts
case "table": {
  const header = b.columns.join(" | ");
  const rows = b.rows
    .map(
      (row) =>
        "- " +
        row.map((c) => c.replaceAll("\n", " ").slice(0, 200)).join(" | ")
    )
    .join("\n");
  return `Table — ${header}\n${rows}`;
}
```

**Verification:** Re-ran `test-chat.ts`. The "largest sample size" question
that previously got *"the extraction table for this run is empty"* now
returns:

> "Bare et al., 1998 had the largest reported sample size at **N=38**, using
> video EEG to identify atypical absence seizures. Deering et al., 2024:
> N=33; Kobayashi et al., 2009: N=20; Dalic et al., 2022a (Paper [1]):
> N=17…"

That's the kind of answer users will ask for and previously couldn't get.

The model also honestly noted that some studies named in the tables (e.g.
Bare et al., 1998) aren't in the paper reference list — a real downstream
issue with the LGS fixture (the synthesized report cites studies beyond the
gathered set) but not a chat-agent problem.

**Prompt size impact:** ~50 rows × ≤1000 chars worst case ≈ 50k chars ≈
~12k tokens added to the chat prompt. Well within model context. Mitigated
by per-cell 200-char truncation.

### Tune 2 — `test-chat-edges.ts` citation regex

The original `/paper\s*\[\d+\]/i` regex missed valid citation forms like
`[Papers 7, 8]` and named cites like `Hödl et al., 2021`. Loosened to
accept all three. Not a behavior change — only a test-correctness fix.

---

## Things noted, not fixed

These are observations from the runs that *could* be tuned later but weren't
worth changing in this pass:

1. **`COLUMN_COUNT = 4`** in `extract.ts` is hard-coded. For deeper questions
   four columns can be tight. Could become dynamic (e.g. 3-6 based on
   question complexity) but no current failure demands it.
2. **The auto-criterion is one sentence**. A real systematic review uses
   multiple inclusion criteria. The current single-criterion mode is fine for
   a demo but is a place where Evoke could grow beyond Elicit-parity.
3. **The LGS fixture's report tables reference studies not in `references`**.
   The synthesized tables (e.g. "Bare et al., 1998") were authored by hand
   and don't all appear in the `references` array. The chat model now flags
   this honestly. Long-term, either expand `references` or have the
   synthesizer constrain its tables to the cited set.
4. **`test-sse.ts` was not run** — needs the dev server. Worth wiring into
   CI later, but not blocking quality.
5. **No full benchmark** — `docs/EVAL.md` is still aspirational. Bootstrapping
   that suite (gold-standard paper IDs, distractors, rubric scoring) is a
   real project, not a sub-task of this pass.

---

## Net result

- All four agents (screen, extract, synthesize, chat) are producing
  high-quality output against the live API.
- One real bug fixed in the chat agent: synthesized-report tables are now
  visible to the model, so the chat can answer per-row questions about the
  run's data.
- Chat scope policy (last session's prefer-grounded-with-fallback change)
  holds up across edge cases — definitional, mixed, clinical, off-topic.
- Pipeline cost per single-question run remains modest: screening ~2.5s,
  extraction ~12s, synthesis ~20s, chat ~5-15s per turn.

## Files touched (Pass 1 — chat agent)

- `lib/agents/chat.ts` — table + notes rendering in the system prompt
- `scripts/test-chat-edges.ts` — new edge-case probe script (later: citation regex loosened)

---

## Pass 2 — pipeline empty-result handling

### Bug report

User-reported failure on a real run:

> Question: "how do you treat tourretts (private)"
> 0 sources from Semantic Scholar
> Pipeline failed: screen: no papers with abstracts to screen

### Root cause

`.env.local` has `ANTHROPIC_API_KEY` and `CORE_API_KEY` but **no
`SEMANTIC_SCHOLAR_API_KEY`**. The user explicitly selected the S2 corpus in
the home-page toggle (they know they should use CORE, but the default is
S2). Unauthenticated S2 returned a 200 response with `data: []` — gather
succeeded with zero papers.

The screen stage then threw:

```ts
if (screenable.length === 0) throw new Error("no papers with abstracts to screen");
```

That propagated as a `stage.error` + `error` event, surfaced in the UI as
the unhelpful red banner.

Two failure paths converged on the same crash: gather returns 0 papers, OR
gather returns N papers but none have abstracts (S2/CORE occasionally
returns metadata-only records).

### Fix

A new shared helper `finalizeEmpty(runId, report, tldr)` in `lib/pipeline.ts`:

```ts
function finalizeEmpty(runId: string, report: Report, tldr: string) {
  saveRun({ ...report, tldr });
  emit(runId, { type: "complete" });
}
```

Two new early-return checks:

1. **After gather** (`runPipeline`): `if (papers.length === 0)` →
   friendly tldr that names the corpus and suggests recovery
   (rewording, switching corpus, or — for S2 — getting an API key).
2. **After `screenable = papers.filter(p => p.abstract)`** in
   `runScreenExtractSynth`: same treatment, different message.

Both emit `complete`, not `error` — the run is a legitimate empty result,
not a system failure.

### UI changes (`components/gather/GatherView.tsx`)

1. **Corpus label** — replaced hardcoded "Semantic Scholar" in the
   `stageMeta.gather` line with `report.corpus === "core" ? "CORE" :
   "Semantic Scholar"`. Was a separate latent bug — CORE runs were
   showing "5 sources from Semantic Scholar".
2. **Conditional navigation on `complete`** — track a local
   `synthCompleted` flag in the SSE handler. On `complete`:
   - If synthesis completed → `router.replace('/report/.../report')` (old behavior)
   - Otherwise → `router.refresh()` — stay on `/gather` so the empty-state
     banner is visible.
3. **Empty-state banner** — new amber notice rendered when
   `report.status.gather.done && sources.length === 0 && !fatalError &&
   !report.status.generate.done` (the "finalizedEmpty" computed flag). Shows
   "No sources found." with the run's saved tldr as the explanation.
4. **Suppress the misleading "Papers will appear here as the pipeline
   progresses" placeholder** when the run has finalized empty.

### Tests

**Unit test — `scripts/test-empty-paths.ts`**

Drives `runFromScreening(runId, q, report, [], criterion)` for both
`corpus: "s2"` and `corpus: "core"`. Verifies:

- No `error` or `stage.error` event emitted
- `complete` event is emitted
- Saved report's `tldr` matches the empty-state message

Result: **2/2 cases pass**. Events seen: `stage.done:gather → complete`.

**End-to-end test — `scripts/test-empty-e2e.ts`**

Starts against the running dev server. Two cases:

- **Case 1**: nonsense query against CORE (no rate-limit risk because we
  have a CORE_API_KEY). Verifies the live empty path end-to-end. ✓ Passes
  with tldr: *"No sources found in CORE for this query. Try rewording
  the question, or switching to Semantic Scholar."*
- **Case 2**: the user's exact query against S2. In this run S2 hit a
  429 (rate limit) rather than 200-empty — that's the existing gather-error
  path, not the bug. Asserts no screen-stage crash. ✓ Passes.

Result: **2/2 cases pass**.

The user's specific in-the-wild scenario (S2 returning 200-empty for a
particular query) shares its code path with Case 1 — gather succeeds, then
the soft-empty check fires and finalizes gracefully.

### What this didn't change

- The corpus toggle UI default is still S2 (not modified). A reasonable
  follow-up is to default to CORE when no `SEMANTIC_SCHOLAR_API_KEY` is
  configured. Out of scope for this fix.
- S2 rate-limit (429) handling — unchanged. Still throws and surfaces as
  a red error banner. Could be softened later if it's a common UX issue.

## Files touched (Pass 2)

- `lib/pipeline.ts` — `corpusLabel`, `finalizeEmpty`, two soft-empty guards
- `components/gather/GatherView.tsx` — dynamic corpus label, conditional
  navigation, empty-state banner, placeholder suppression
- `scripts/test-empty-paths.ts` — new unit-style test for empty paths
- `scripts/test-empty-e2e.ts` — new live e2e test for empty paths
