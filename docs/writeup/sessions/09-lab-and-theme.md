# Session 9 — unlock the Lab, then theme the whole app

**Date:** 2026-05-16
**Goal:** Make the Lab tools (Systematic Review, Extract data) actually usable
and visually consistent with the rest of Evoke; ended up doing the entire
app-wide theme system.

## What landed

- Removed the cosmetic "PRO" lock on Systematic Review + Extract data (both the
  elicit-clone surface and the ResearchShell sidebar/dropdown).
- `LabShell` — every Lab tool now renders inside the shared sidebar/topbar
  instead of bare.
- Extract data: draws papers from Library **and** selection (deduped picker);
  editable/custom columns; prompt-card input; CSV export.
- Systematic Review: token-styled, dark-correct, "what it does / use it when"
  explainer panel.
- App-wide theme: CSS-variable token system, `:root` dark + `html.light`,
  `darkMode:"class"` retired. ~28 components migrated off hardcoded hex; all
  hybrids' dead `dark:` stripped.
- New accent tokens: `text-teal-bright`, `error`/`error-bg`,
  `warning`/`warning-bg` — added because the same contrast bug kept recurring.
- README "known limitations" section; writeup sections 10 & 11.

## What surprised me

- **Plan sequencing bit me twice.** "Strip the dead `dark:` variants" got filed
  as cosmetic cleanup. It was load-bearing — with no `.dark` class ever set,
  `bg-white dark:bg-[#0F0F0F]` shells were pinned white forever. A deferral is
  only safe if you've traced what depends on it.
- **Tokens introduced a brand-new bug class.** Hardcoding had *masked* the fact
  that the brand teal is unreadable on dark. Migrating to a correct system
  surfaced ~12 invisible-teal sites. Fixing the system can reveal defects the
  mess was hiding.
- **The recurrence count is the diagnostic.** While I was patching theme
  screen-by-screen, the count of broken screens wasn't dropping. That's the
  tell for "wrong layer."
- **Couldn't see the output.** Browser automation segfaulted the whole session.
  The contrast-ratio reviewer pass — not the human — caught every invisible
  regression. The proxy that reasons *across* the diff beats the author who
  sees one change at a time.
- A leaked API key and a separate Finder crash ate real time before any of the
  actual work started. Unglamorous, but the rotation discipline mattered.

## What I'd do differently

- Do the token layer **first**, before touching a single component. Every
  screen-by-screen fix done before the system existed was wasted.
- Treat "strip dead `dark:`" as part of the system change, not a follow-up.
- Add the contrast-ratio check to the review gate from task one, not after the
  third invisible-teal bug.

## Open questions

- Stored-light FOUC: worth the inline `<head>` script now, or genuinely fine to
  leave documented?
- Systematic Review's real Elicit-parity rebuild (multi-criterion, staged,
  exports) is its own project — when, and is full-text screening ever in reach
  without a PDF pipeline?
- Decision pills stayed fixed Tailwind tints. Readable on both themes, but is
  "mostly consistent" the right call vs. tokenizing them too?
