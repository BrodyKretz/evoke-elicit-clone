# Theme Plan B: Migrate Hardcoded Components → Tokens

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Replace hardcoded hex in the un-migrated components with the semantic Tailwind tokens (now theme-aware from Plan A), so every screen is consistent in dark (default) and light. No `dark:` variants — tokens flip automatically.

**Architecture:** Pure className substitutions guided by one authoritative hex→token role map. Priority batches; each batch independently shippable and user-verifiable. Layout/logic untouched.

**Tech Stack:** Next.js 14, Tailwind 3 (CSS-var tokens from Plan A), Node test runner.

Spec: `docs/superpowers/specs/2026-05-16-app-wide-theme-design.md` (§3).

---

## Authoritative hex → token map

Map every hardcoded hex by the ROLE it plays (regardless of whether the
original value was light or dark — both light-origin files like LibraryView
and dark-origin files like FindPapers converge to the same tokens):

| Role (how the hex is used) | Token class |
|---|---|
| App/page background (lightest light OR darkest dark: `#FFFFFF`,`#FAFAF9`,`#0D0D0D`,`#0F0F0F`,`#171717`,`#202020`) | `bg-bg` |
| Card / panel surface (`#F9FAFB`,`#FAFAFA`,`#1F1F1F`,`#2A2A2A`,`#242424`) | `bg-surface` |
| Recessed / muted surface, table header, hover row (`#F3F4F6`,`#F0EDE3`,`#2F2F2F`,`#1A1A1A`) | `bg-surface-muted` |
| Primary text (`#1F2937`,`#1A1F1F`,`#111827`,`#ECECEC`,`#FFFFFF`-as-text) | `text-text` |
| Secondary text (`#6B7280`,`#6B7270`,`#5D5D5D`,`#B4B4B4`) | `text-text-muted` |
| Tertiary/faint text (`#9CA3AF`,`#9CA09C`,`#8E8E8E`,`#A0A0A0`) | `text-text-faint` |
| Border, default (`#E5E7EB`,`#E5E1D6`,`#2F2F2F`,`#2C2C2C`) | `border-border` |
| Border, strong/emphasis (`#D1D5DB`,`#D4CFC0`,`#3F3F3F`,`#333333`) | `border-border-strong` |
| Teal accent (`#0F5C5C`,`#1F6E68`,`#1F6E68`) | `text-teal` / `bg-teal` (match original prop) |
| Teal hover (`#0A4A4A`,`#185650`) | `hover:bg-teal-hover` / `hover:text-teal-hover` |
| Teal tint surface (`#E8F0EE`,`#E6F4F2`,`#14302E`) | `bg-teal-light` |
| Decision include/maybe/exclude hues, and Tailwind palette opacity classes (`bg-emerald-*`,`bg-rose-50/50`,`bg-amber-*`,`bg-white/15`) | LEAVE AS-IS (Plan C handles decision-styles) |
| Any hex not listed | nearest role row by usage (bg vs text vs border). NEVER invent a hex. |

Preserve the Tailwind prefix the original used (`bg-`/`text-`/`border-`/`hover:`/`ring-`). Remove now-dead local color constants/objects. Do NOT add any `dark:` variants. Do NOT change layout, spacing, JSX, or logic — color only.

Per-file done = `grep -nE '#[0-9A-Fa-f]{6}' <file>` returns nothing except allowed decision/palette opacity classes, and `tsc` passes.

---

## Task B1: Batch 1 — FindPapers + LibraryView (highest visibility)

**Files:** Modify `components/lab/FindPapers.tsx`, `components/library/LibraryView.tsx`

- [ ] **Step 1:** For each file: `grep -nE '#[0-9A-Fa-f]{6}' <file>` to list every hex+line.
- [ ] **Step 2:** Replace each per the role map above. Remove dead color consts. No `dark:` variants. Layout/logic unchanged.
- [ ] **Step 3:** Verify no disallowed hex remains:
  `cd ~/Developer/Evoke && grep -nE '#[0-9A-Fa-f]{6}' components/lab/FindPapers.tsx components/library/LibraryView.tsx | grep -viE 'emerald|rose|amber|/15|/50|/60'` → expect empty. Then `npx tsc --noEmit` (0) and `npm test` (25 pass).
- [ ] **Step 4:** DOM smoke: `curl -s http://localhost:3000/lab/find | grep -o -e 'bg-bg' -e 'text-text' | sort -u` and same for `/library` — token classes present, and `grep -oE '#[0-9A-Fa-f]{6}' ` on the rendered HTML shows no stray non-palette hex.
- [ ] **Step 5:** Commit:
  `cd ~/Developer/Evoke && git add components/lab/FindPapers.tsx components/library/LibraryView.tsx && git -c user.email=local -c user.name=local commit -q -m "Theme B1: migrate FindPapers + LibraryView to tokens"`
- [ ] **Step 6:** USER visual confirmation (explicit, not implementer-claimed): user screenshots `/lab/find` and `/library` in dark AND light; must be consistent + readable, matching the rest.

## Task B2: Batch 2 — primary surfaces

**Files:** Modify `components/research-agent/ResearchShell.tsx`, and every file under `components/report/`, `components/extraction/`, `components/search/` that contains hardcoded hex.

- [ ] **Step 1:** `grep -rlnE '#[0-9A-Fa-f]{6}' components/report components/extraction components/search components/research-agent/ResearchShell.tsx` → the file list.
- [ ] **Step 2:** Apply the role map to each file. Remove dead color consts. No `dark:` variants. (ResearchShell currently has `dark:#hex` pairs — replace the LIGHT half with the token and DELETE the paired `dark:` variant, since the token now handles both themes.)
- [ ] **Step 3:** `grep` (excluding emerald/rose/amber/opacity) empty across all; `npx tsc --noEmit` 0; `npm test` 25 pass.
- [ ] **Step 4:** DOM smoke on `/research-agent`, `/report` (if routable) — token classes present, no stray hex; `bash scripts/lab-endpoints-test.sh` tail = ALL PASSED.
- [ ] **Step 5:** Commit: `... -m "Theme B2: migrate report/extraction/search/ResearchShell to tokens"`
- [ ] **Step 6:** USER visual confirmation: `/research-agent` + a report view, dark & light.

## Task B3: Batch 3 — remaining components

**Files:** Modify every remaining file under `components/` and `app/` containing hardcoded hex EXCEPT decision-styles (Plan C): home/*, progress/*, lab/* (not already done), elicit-clone/*, any app/*.tsx.

- [ ] **Step 1:** `grep -rlE '#[0-9A-Fa-f]{6}' components app --include=*.tsx | sort` minus already-migrated → list.
- [ ] **Step 2:** Apply role map per file. Remove dead consts. No `dark:`. Skip `lib/lab/decision-styles.ts` (Plan C).
- [ ] **Step 3:** App-wide check: `grep -rlE '#[0-9A-Fa-f]{6}' components app --include=*.tsx` → only `lib/lab/decision-styles.ts`-style allowed (decision/palette) remain; `npx tsc --noEmit` 0; `npm test` 25 pass.
- [ ] **Step 4:** `bash scripts/lab-endpoints-test.sh` tail = ALL PASSED; DOM smoke a couple of routes.
- [ ] **Step 5:** Commit: `... -m "Theme B3: migrate remaining components to tokens"`
- [ ] **Step 6:** USER visual confirmation across a broad sample, dark & light.

---

## Self-Review

**Spec coverage:** §3 batches 1/2/3 → Tasks B1/B2/B3 exactly. The "strip
redundant dark: hex from the 6 hybrids" (§4) is folded into B2 where
ResearchShell is touched, and remaining hybrid `dark:` strip + decision colors
(§5) are Plan C.

**Placeholder scan:** The hex→token map is the authoritative concrete rule
(same pattern proven in Plan 1); per-file lists are produced by the exact grep
given. No TBD.

**Type consistency:** Token class names match Plan A's tailwind config
(`bg-bg`,`bg-surface`,`bg-surface-muted`,`text-text`,`text-text-muted`,
`text-text-faint`,`border-border`,`border-border-strong`,`teal`,`teal-hover`,
`teal-light`). decision/palette exclusions consistent across all 3 tasks.

**Known follow-up (Plan C):** strip residual `dark:` hex from LabExtract/
ReviewSearch/LabShell/LabSidebar/LabTopBar/AnimatedPlaceholder/ThemeToggle;
make decision-styles theme-aware; optional stored-light FOUC inline script.
