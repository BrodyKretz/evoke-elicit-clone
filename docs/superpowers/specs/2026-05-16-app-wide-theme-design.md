# App-Wide Theme System (Dark-First) — Design Spec

**Date:** 2026-05-16
**Status:** Approved, ready for implementation plan

## Problem

The app has no shared theme. 28 components hardcode their own hex; 22 have
zero dark-mode support. Some screens render dark (FindPapers, ResearchShell),
some light-only (LibraryView), six are token+`dark:` hybrids (Plan 1/2 work).
Result: navigating between Find papers / Library / Extract / Review shows
inconsistent and sometimes unreadable (dark-on-dark) UI. Per-tool patching has
not produced consistency.

## Goal

One theme system. Every screen consistent in both themes, driven by a single
source of truth. **Dark is canonical/default** (matches the research-agent
reference the user approved); light is the secondary toggle.

## Non-goals (deferred)

Systematic Review Elicit-rebuild (multi-criterion/staged/CSV). Fulltext
screening. `CORE_API_KEY` rotation. No visual redesign beyond color/theme —
layouts unchanged.

## Design

### 1. Token infrastructure

- `app/globals.css`: define color channels as CSS custom properties.
  `:root` holds the **dark** palette (default, dark-first). A `.light` class on
  `<html>` overrides them to the light palette. Use space-separated RGB
  channels so Tailwind alpha utilities keep working:
  `--c-bg: 15 15 15;` (dark) under `:root`, `--c-bg: 245 242 234;` under
  `html.light`, etc.
- `tailwind.config.ts`: every semantic token becomes
  `bg: "rgb(var(--c-bg) / <alpha-value>)"` (and surface, surface-muted,
  border, border-strong, text/.muted/.faint, teal/.hover/.light, chip, examples).
- `globals.css` existing `theme("colors.bg")` references continue to resolve
  (they now resolve to the var-based color) — verify base html/body +
  `.btn`/`.section-label` still render.

**Canonical dark values** (`:root`): bg `#0F0F0F` (15 15 15), surface
`#1F1F1F` (31 31 31), surface-muted `#2A2A2A` (42 42 42), border `#2F2F2F`
(47 47 47), border-strong `#3F3F3F` (63 63 63), text `#ECECEC` (236 236 236),
text-muted `#B4B4B4` (180 180 180), text-faint `#8E8E8E` (142 142 142), teal
`#1F6E68` (31 110 104), teal-hover `#185650` (24 86 80), teal-light `#14302E`
(20 48 46), chip-bg `#2A2A2A`, chip-border `#3F3F3F`, examples `#2A2A2A`.

**Light values** (`html.light`): the existing warm-paper set — bg `#F5F2EA`,
surface `#FFFFFF`, surface-muted `#FAF8F2`, border `#E5E1D6`, border-strong
`#D4CFC0`, text `#1A1F1F`, text-muted `#6B7270`, text-faint `#9CA09C`, teal
`#0F5C5C`, teal-hover `#0A4A4A`, teal-light `#E8F0EE`, chip-bg `#F0EDE3`,
chip-border `#E0DCCE`, examples `#DDE3DE`.

### 2. ThemeToggle

`components/research-agent/ThemeToggle.tsx`: currently toggles `.dark` and
defaults to system. Change to: default = **dark** (no class) when no stored
preference; toggling light adds `html.light`, dark removes it. Keep
localStorage persistence and the toggle button. Update any code that keys off
the `.dark` class to the new `.light` convention (grep `classList`,
`"dark"`, `matchMedia`). Tailwind `darkMode` config: switch from
`"class"`/`dark:` usage to the var system (dark is default; `dark:` variants
become unnecessary and are removed in step 4).

### 3. Migrate the 22 hardcoded components → tokens

Replace hardcoded hex with the semantic token class matching its role
(background→bg/surface/surface-muted, text→text/.muted/.faint,
border→border/.strong, accent→teal). No `dark:` variants — tokens flip
automatically. Layout/logic unchanged. Priority batches:
- **Batch 1:** `components/lab/FindPapers.tsx`, `components/library/LibraryView.tsx`
- **Batch 2:** report/extraction/search views (`components/report/*`,
  `components/extraction/*`, `components/search/*`,
  `components/research-agent/ResearchShell.tsx`)
- **Batch 3:** remaining hardcoded components (home, progress, lab/*, elicit-clone/*)

Mapping rule per file: `grep -n '#[0-9A-Fa-f]\{6\}'`, replace each by role per
a fixed hex→token table (authored in the plan), remove dead local color
constants. Done when `grep` returns zero hex for that file and `tsc` passes.

### 4. Strip redundant `dark:` hex from the 6 hybrid files

`LabExtract.tsx`, `ReviewSearch.tsx`, `LabSidebar.tsx`, `LabTopBar.tsx`,
plus the two `dark:`-bearing spots in `ResearchShell.tsx`/`LabShell.tsx`:
remove every `dark:bg-[#…]/dark:text-[#…]/dark:border-[#…]` that pairs with a
semantic token (the token now handles both themes). Keep non-token Tailwind
palette opacity classes (e.g. `bg-rose-50/50`) — see step 5.

### 5. Decision colors

`lib/lab/decision-styles.ts`: include/maybe/exclude currently light tints
(emerald/amber/rose-100/800). Add theme-awareness: define dark and light
class sets, selected the same way as tokens (CSS-var-driven badge/row colors,
or a `.light`-scoped override). Pills must read well on the dark canonical
theme and on light. Single source of truth retained.

## Data / type changes

None. Pure styling/config. `decision-styles.ts` keeps its
`Record<Decision,{label,badge,row}>` shape (values may become var-based).

## Testing

Match existing `tests/` (node:test). Given Chrome segfaults locally, layered
verification:
- **Unit:** a test asserting `globals.css` defines every `--c-*` var under
  both `:root` and `html.light`, and `tailwind.config.ts` references each via
  `var(--c-*)`. A test that `decisionStyles` has both theme variants and no
  raw dark hex.
- **Static:** per migrated file, `grep` proves zero hardcoded `#hex` remain;
  `tsc --noEmit` clean; full `npm test` green; `bash
  scripts/lab-endpoints-test.sh` still passes (no runtime regression).
- **DOM:** `curl` rendered routes show token classes and no stray hex.
- **Human:** user screenshots a representative set (Find papers, Library,
  Extract, Review, a report) in BOTH dark and light and confirms consistency
  and readability. Pixel verification is the user's — stated explicitly, not
  claimed by the implementer.

## Decomposition (each independently shippable)

- **Plan A — token infra:** globals.css vars + tailwind.config + ThemeToggle
  default-dark + unit tests. Small, foundational. After this, the 6 hybrid
  files already look right in both themes via tokens; nothing else regresses.
- **Plan B — migrate hardcoded components** in the 3 priority batches.
- **Plan C — strip redundant `dark:` hex** from the 6 hybrids + decision
  colors final pass.

## Risks / decisions

- Switching token definitions affects every token consumer at once. Mitigation:
  Plan A is isolated and verified (unit + DOM + user screenshot) before any
  component migration.
- `darkMode: "class"` + existing `dark:` utilities: during the transition the
  six hybrids carry redundant `dark:` hex; harmless until Plan C removes them
  (token wins for the non-dark default = dark; `dark:` only applied if a
  `.dark` class existed — it won't, so they're inert, not conflicting).
  Re-verify after Plan A that hybrids render dark correctly via tokens alone.
- Opacity utilities on tokens (`bg-surface/50`) require the
  `rgb(var() / <alpha-value>)` form — used deliberately, not plain hex vars.
- Tailwind palette classes (emerald/rose/amber, `bg-white/15` in the teal
  header) are intentionally NOT tokenized; they're fixed accents that read on
  both themes. decision-styles handled separately in Plan C.
