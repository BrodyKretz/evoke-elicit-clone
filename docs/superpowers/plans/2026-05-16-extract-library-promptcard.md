# Plan 2: Extract Data — Library+Selection sources + Prompt-card UI

> Continuation of the lab-tools effort (Plan 1 done). Branch: lab-unlock-ui-parity. Execute via subagents, verify each task, user confirms visually.

**Goal:** Extract Data draws papers from BOTH the Library and the existing selection (deduped, user-pickable), and its question input is restyled to the prompt-card format (teal header chip + large dark textarea + example chips + run footer), dark-mode correct.

## Context (verified)

- `lib/library.ts`: `getLibrary(): LibraryEntry[]` where `LibraryEntry = { paper: Paper; savedAt: string; source?: string }`; `subscribeLibrary(cb): () => void`.
- `lib/lab/selection.ts`: `getSelectedPapers(): Paper[]`; `subscribeSelection(cb): () => void`.
- `components/lab/LabExtract.tsx` currently: reads ONLY `getSelectedPapers()`, auto-uses all of them, plain pill input, posts `{papers, question}` to `/api/lab/extract`. Dark variants already present.
- `/api/lab/extract` already accepts `{papers: Paper[], question}` and returns `{columns, rows, skipped}`. No API change needed.
- Reference prompt-card visual (user image 6): teal header bar with a rounded chip + chevron; large dark textarea below; small "Try a couple of free examples" label + example chips; footer row with action on the right.

## Task A: Paper pool = Library ∪ Selection, with a picker

**File:** modify `components/lab/LabExtract.tsx`

- Import `getLibrary, subscribeLibrary` from `@/lib/library` (keep selection imports).
- Build the pool: `const pool = useMemo(() => dedupe([...getSelectedPapers(), ...getLibrary().map(e => e.paper)]))` by `paper.id`. Track each id's origin: in selection, in library, or both.
- Subscribe to BOTH stores (subscribeSelection + subscribeLibrary); refresh pool on either.
- Add `selectedIds: Set<string>` state, defaulting to ALL pool ids; when the pool changes, keep existing choices and default-select any new ids.
- Render a picker section (above the table, below the prompt card): a scrollable list, one row per pool paper — checkbox, title (truncate), authors·year, and a small tag showing origin ("Library" / "Selection" / "Both"). A header row: "Papers (N selected of M)" + "Select all / none" toggle.
- `run()` posts only the checked papers: `papers: pool.filter(p => selectedIds.has(p.id))`. Guard: disabled if 0 checked.
- Empty state shows ONLY when pool is empty (both sources empty). Update copy: "No papers yet. Save papers to your Library or select them in Find papers." with two links: `/lab/find` (Find papers) and `/library` (View library).
- Keep all existing result-table rendering and dark variants intact. Match existing token+dark class pattern (`text-text dark:text-[#ECECEC]`, `bg-surface dark:bg-[#1F1F1F]`, `bg-surface-muted dark:bg-[#2A2A2A]`, `border-border dark:border-[#2F2F2F]`).

**Verify:** `npx tsc --noEmit` (0); `npm test` (all pass); dev server — `curl -s localhost:3000/lab/extract | grep -o 'View library'` shows the new link is present. Functional: with localStorage empty the empty-state copy mentions Library; (manual/user) saving a paper in Find papers then opening Extract shows it in the picker.

## Task B: Prompt-card restyle of the question input

**File:** modify `components/lab/LabExtract.tsx` (replace the `<form>` pill block, lines ~106-128)

Build a prompt-card matching image 6, using the established dark palette:

- Outer: `rounded-2xl overflow-hidden border border-border dark:border-[#2F2F2F]`.
- Header bar: `bg-teal px-4 py-3` containing a white chip `inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white` with a Grid icon + label "Extract data".
- Body: `bg-surface dark:bg-[#1F1F1F] px-4 py-4`; a `<textarea>` (rows=3, auto-grow not required) replacing the input — same `question` state — placeholder "What question should this extraction answer? (guides the columns)", classes `w-full resize-none bg-transparent text-[15px] text-text dark:text-[#ECECEC] outline-none placeholder:text-text-faint dark:placeholder:text-[#8E8E8E]`.
- Example chips row under the textarea: small label `text-[12px] text-text-faint dark:text-[#8E8E8E]` "Try an example" + 3 buttons that set `question` on click: "Efficacy outcomes by study design", "Sample size and population", "Reported limitations". Chip style: `rounded-md bg-surface-muted dark:bg-[#2A2A2A] px-3 py-1.5 text-[13px] text-text dark:text-[#ECECEC] hover:opacity-80`.
- Footer row: `border-t border-border dark:border-[#2F2F2F] px-3 py-2.5 flex items-center justify-between`; left: muted hint `text-[12px] text-text-faint dark:text-[#8E8E8E]` showing "{selectedCount} paper(s)"; right: the Run button (keep existing teal button + disabled logic; label "Run extract" / "Extracting…").
- Submitting (button) calls `run()`. Keep the `<form onSubmit>` wrapper so Enter still works (textarea: Cmd/Ctrl+Enter triggers submit — add an onKeyDown for that).

**Verify:** `npx tsc --noEmit` (0); `npm test` (pass); `curl -s localhost:3000/lab/extract | grep -o -e 'Extract data' -e 'Try an example'` shows header chip + examples present; user screenshots light AND dark — must visually match image-6 style and be readable in dark.

## Task C: Final verification

- `npm test` full suite green.
- `bash scripts/lab-endpoints-test.sh` still passes (no API regression).
- Hand to user for visual confirmation in dark mode before any merge.

## Out of scope (next: Plan 3)

Systematic Review Elicit-rebuild (multi-criterion, staged, CSV export, prompt-card) — separate plan after this ships. No fulltext screening anywhere.
