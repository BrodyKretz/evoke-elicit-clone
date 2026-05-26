# Evoke

An open-source clone of [Elicit](https://elicit.com) — semantic paper search, screening, extraction, and AI-generated research reports.

## Live demo

[evoke-elicit-clone.fly.dev](https://evoke-elicit-clone.fly.dev) — deployed on Fly.io. **BYO API key.** Visitors paste their own [Anthropic key](https://console.anthropic.com/settings/keys) into the in-app settings dialog (top-right key icon); the key lives in your browser&rsquo;s localStorage and is sent per-request via HTTPS header. Nothing is persisted server-side. Optional: paste an S2 key for higher Semantic Scholar throughput, or leave blank to use the free unauthenticated tier.

## New: Agentic RAG mode (beyond the Elicit clone)

Elicit's pipeline is one-shot: pull N papers for a query, screen, extract, synthesize, done. **Agentic RAG flips that** — the LLM drives the retrieval loop itself:

```
query → agent thinks → decides what to search → reads results
      → decides if it has enough → if not, searches again differently
      → synthesize
```

For a query like *"what peptides have shown efficacy in gut permeability repair?"* the agent might:

1. Search broadly first, read abstracts.
2. Notice most results cluster around tight-junction proteins → run a follow-up search specifically on claudin-targeting peptides.
3. Spot a promising preprint → fetch its full methods section.
4. Find a cited study it doesn't yet have → retrieve that too.
5. Synthesize across the whole working set.

The button lives in the sidebar under *Workflows* (`/agentic-rag`). The surface is shipped; the agent loop itself is the next milestone — see `docs/writeup/` for design notes.

> **Status: end-to-end pipeline shipped.** All four stages (gather → screen → extract → synthesize) are wired and each agent is verified in isolation. Live progress streams via SSE. Editable screening criterion + re-screen loop. ~$0.15-0.25 per full run.

## What it does (eventually)

Same four-stage pipeline as Elicit:

1. **Gather sources** — semantic search across a paper corpus, ranked by similarity + citation count + recency.
2. **Screen sources** — narrow down with natural-language screening criteria.
3. **Extract data** — pull structured fields from each paper (study design, sample size, outcomes, etc.).
4. **Generate report** — synthesize the extracted data into a narrative review with tables and citations.

Target: 1,000 papers analyzed per query.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment variables

Create `.env.local` (already gitignored) for any keys:

```bash
# Required — used by screening, extraction, synthesis, and chat.
ANTHROPIC_API_KEY=

# At least one corpus key required. Pick a provider via the top-left toggle
# on the home page. Each key lights up its provider in the toggle.
#
# Semantic Scholar — better semantic ranking, abstract-only.
# Apply: https://www.semanticscholar.org/product/api#api-key-form
SEMANTIC_SCHOLAR_API_KEY=

# CORE — full-text PDF access for OA papers, less tuned ranking.
# Apply: https://core.ac.uk/services/api (request the "API KEY" product;
# not Dataset / FastSync / Recommender / Discovery — those are different
# CORE offerings).
CORE_API_KEY=
```

Add keys without exposing them to your shell history:

```zsh
read -s "key?Anthropic API key (hidden): " && printf "\nANTHROPIC_API_KEY=%s\n" "$key" >> .env.local && unset key && echo "✓ saved"
```

Three example reports are seeded, each at a different pipeline stage so you can see the full flow:

- **Lennox-Gastaut biomarkers** — complete report
- **CBT vs. face-to-face for depression** — paused at search results
- **Neuroendocrine prostate cancer targets** — mid-gathering

## Layout

```
app/                  Next.js App Router routes
  page.tsx              Home (search + example cards)
  report/[id]/...       The 5-tab report viewer
  api/...               Mock JSON endpoints (will host the real agent calls)
components/           UI building blocks (TopBar, Tabs, Sidebar, tables, etc.)
lib/
  types.ts            Paper, Report, Pipeline types
  data/fixtures/      Seeded example reports
docs/
  ARCHITECTURE.md     System overview
  DECISIONS.md        Running ADR log
  writeup/            Section stubs for the final blog post
```

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS. Mock API routes today; Python agent layer planned for phase 2.

## Known limitations & deferred scope

Honest about what's *not* built yet:

- **Systematic Review is single-stage.** It does abstract screening against one
  (editable) inclusion criterion. Elicit's multi-criterion + staged
  (abstract → full-text) screening with per-stage CSV/XLSX export is **not
  built** — only the abstract-screen slice plus an in-app explainer panel.
- **Abstract-only.** Screening and extraction read paper abstracts; there is no
  full-text/PDF parsing and no bring-your-own-PDF flow.
- **Extraction.** The Lab Extract tool supports editable/custom columns, a
  Library + selection paper picker, and CSV export. A re-extract cascade inside
  the full report flow is not built.
- **Theme.** App-wide light/dark theme via CSS-variable tokens, dark by
  default, toggleable. Minor: if a `light` preference is stored, the first
  paint can briefly flash dark before hydration (no SSR inline theme script).
  Include/maybe/exclude decision pills intentionally use fixed Tailwind tints.
- **Keys are user-provided.** `ANTHROPIC_API_KEY` and a corpus key must be set
  in `.env.local`; none are bundled.

## Writeup

Documenting the build as we go — see `docs/writeup/` for the running outline. Modeled after [Shlok's OpenPoke writeup](https://www.shloked.com/writing/openpoke).
