# Evoke

An open-source clone of [Elicit](https://elicit.com) — semantic paper search, screening, extraction, and AI-generated research reports.

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

## Writeup

Documenting the build as we go — see `docs/writeup/` for the running outline. Modeled after [Shlok's OpenPoke writeup](https://www.shloked.com/writing/openpoke).
