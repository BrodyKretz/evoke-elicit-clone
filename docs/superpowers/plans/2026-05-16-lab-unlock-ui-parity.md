# Lab Unlock + UI Parity + Verify — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cosmetic PRO lock on Systematic Review + Extract Data, convert their UIs (and the Lab chrome) from hardcoded dark hex to Evoke's semantic light tokens, and prove both standalone Lab endpoints work via live tests.

**Architecture:** Pure edits to existing files — no new runtime architecture. One new tiny shared module for decision colors so Review's badges stay consistent. Verification is live HTTP against the running dev server plus a Playwright screenshot for theme parity.

**Tech Stack:** Next.js 14, TypeScript, Tailwind (semantic tokens in `tailwind.config.ts`), Node test runner (`node --import tsx --test`), Playwright (already available as an MCP tool).

Spec: `docs/superpowers/specs/2026-05-16-lab-tools-unlock-ui-parity-design.md`

---

## File Structure

- `lib/elicit-clone/constants.ts` — modify: drop `pro: true` (2 entries).
- `tests/elicit-clone-constants.test.ts` — create: guards the unlock.
- `lib/lab/decision-styles.ts` — create: single source of include/maybe/exclude classes.
- `components/lab/ReviewSearch.tsx` — modify: hex → tokens, use decision-styles.
- `components/lab/LabExtract.tsx` — modify: hex → tokens.
- `components/lab/LabSidebar.tsx` — modify: hex → tokens.
- `components/lab/LabTopBar.tsx` — modify: hex → tokens.
- `tests/lab-decision-styles.test.ts` — create: asserts the map is total.
- `scripts/lab-endpoints-test.sh` — create: live verification of both endpoints.

---

## Hex → Token Mapping (authoritative for Task 3)

Tokens from `tailwind.config.ts`. Apply this exact map wherever the hex appears
(as `bg-[#..]`, `text-[#..]`, `border-[#..]`, `ring-[#..]`, inline `style`):

| Hardcoded hex | Role | Replace with class |
|---|---|---|
| `#0D0D0D`, `#202020` | app background | `bg-bg` |
| `#2A2A2A`, `#2F2F2F` | panel/surface | `bg-surface` |
| `#1A1A1A`, `#242424` | muted surface | `bg-surface-muted` |
| `#ECECEC`, `#FFFFFF` (text) | primary text | `text-text` |
| `#B4B4B4` | secondary text | `text-text-muted` |
| `#8E8E8E`, `#6B6B6B` | faint text | `text-text-faint` |
| `#3F3F3F`, `#333333` | border | `border-border-strong` |
| `#2C2C2C`, `#262626` | subtle border | `border-border` |
| `#1F6E68`, `#0F5C5C` | accent | `text-teal` / `bg-teal` (match original prop) |
| `#185650`, `#0A4A4A` | accent hover | `hover:bg-teal-hover` |
| include hue (`#5FE3C6`, `#1F3A36`, etc.) | screening: include | from `decisionStyles` (Task 2) |
| maybe hue (`#FFE08E`, `#3F3A1F`, etc.) | screening: maybe | from `decisionStyles` |
| exclude hue (`#FF9F8E`, `#3A1F1F`, etc.) | screening: exclude | from `decisionStyles` |

If a hex isn't in this table, pick the closest role row by how it's used
(background vs text vs border) — never invent a new arbitrary hex.

---

## Task 1: Unlock Systematic Review + Extract Data

**Files:**
- Test: `tests/elicit-clone-constants.test.ts` (create)
- Modify: `lib/elicit-clone/constants.ts:33,39`

- [ ] **Step 1: Write the failing test**

Create `tests/elicit-clone-constants.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW_ITEMS, TOOL_ITEMS } from "../lib/elicit-clone/constants";

test("systematic-review is not gated behind a PRO badge", () => {
  const sr = WORKFLOW_ITEMS.find((i) => i.key === "systematic-review");
  assert.ok(sr, "systematic-review item must exist");
  assert.notEqual(sr.pro, true, "systematic-review must not be pro-locked");
});

test("extract-data is not gated behind a PRO badge", () => {
  const ed = TOOL_ITEMS.find((i) => i.key === "extract-data");
  assert.ok(ed, "extract-data item must exist");
  assert.notEqual(ed.pro, true, "extract-data must not be pro-locked");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/elicit-clone-constants.test.ts`
Expected: FAIL — both assertions throw (`pro` is currently `true`).

- [ ] **Step 3: Make the minimal change**

In `lib/elicit-clone/constants.ts`:
- Line 33: change
  `{ key: "systematic-review", label: "Systematic review", icon: ListChecks, pro: true },`
  to
  `{ key: "systematic-review", label: "Systematic review", icon: ListChecks },`
- Line 39: change
  `{ key: "extract-data", label: "Extract data", icon: Scan, pro: true },`
  to
  `{ key: "extract-data", label: "Extract data", icon: Scan },`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/elicit-clone-constants.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/Evoke && git add tests/elicit-clone-constants.test.ts lib/elicit-clone/constants.ts && git -c user.email=local -c user.name=local commit -q -m "Unlock Systematic Review + Extract Data (remove cosmetic PRO gate)"
```

---

## Task 2: Shared decision-style map

**Files:**
- Create: `lib/lab/decision-styles.ts`
- Test: `tests/lab-decision-styles.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/lab-decision-styles.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionStyles, type Decision } from "../lib/lab/decision-styles";

test("every decision has badge + row classes on the light theme", () => {
  const decisions: Decision[] = ["include", "maybe", "exclude"];
  for (const d of decisions) {
    const s = decisionStyles[d];
    assert.ok(s, `missing styles for ${d}`);
    assert.ok(s.badge.length > 0, `${d}.badge empty`);
    assert.ok(s.row.length > 0, `${d}.row empty`);
    assert.ok(s.label.length > 0, `${d}.label empty`);
    // Light-theme guard: must not reuse the old dark arbitrary hex.
    assert.doesNotMatch(s.badge + s.row, /#0D0D0D|#2A2A2A|#ECECEC/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/lab-decision-styles.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the module**

Create `lib/lab/decision-styles.ts`:

```ts
// Single source of truth for screening-decision visuals. Tuned for the
// light (warm-paper) theme so Review badges match the rest of Evoke.
export type Decision = "include" | "maybe" | "exclude";

export const decisionStyles: Record<
  Decision,
  { label: string; badge: string; row: string }
> = {
  include: {
    label: "Include",
    badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    row: "border-emerald-200 bg-emerald-50/60",
  },
  maybe: {
    label: "Maybe",
    badge: "bg-amber-100 text-amber-800 border border-amber-200",
    row: "border-amber-200 bg-amber-50/60",
  },
  exclude: {
    label: "Exclude",
    badge: "bg-rose-100 text-rose-800 border border-rose-200",
    row: "border-rose-200 bg-rose-50/50",
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/lab-decision-styles.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/Evoke && git add lib/lab/decision-styles.ts tests/lab-decision-styles.test.ts && git -c user.email=local -c user.name=local commit -q -m "Add shared light-theme decision-style map for Lab"
```

---

## Task 3: Convert the four Lab components to semantic tokens

**Files (modify):** `components/lab/ReviewSearch.tsx`,
`components/lab/LabExtract.tsx`, `components/lab/LabSidebar.tsx`,
`components/lab/LabTopBar.tsx`

This task is mechanical but must be verified visually, not just by typecheck.

- [ ] **Step 1: Apply the Hex → Token Mapping table**

For each of the four files, replace every hardcoded hex occurrence per the
mapping table above. In `ReviewSearch.tsx`, replace the local
include/maybe/exclude color logic with `decisionStyles` from
`lib/lab/decision-styles.ts` (import it; use `.badge` for the decision pill,
`.row` for the paper card border/background, `.label` for the text).

Procedure per file:
1. `grep -n '#[0-9A-Fa-f]\{6\}' <file>` to list every hex + line.
2. Replace each per the table (preserve the Tailwind prefix — `bg-`/`text-`/
   `border-`/`hover:` — that the original used).
3. Remove now-dead local color constants/objects.

- [ ] **Step 2: Verify no hex remains and it compiles**

Run:
```bash
cd ~/Developer/Evoke && grep -rn '#[0-9A-Fa-f]\{6\}' components/lab/ReviewSearch.tsx components/lab/LabExtract.tsx components/lab/LabSidebar.tsx components/lab/LabTopBar.tsx ; npx tsc --noEmit
```
Expected: grep prints **nothing** (zero hex left); `tsc` exits 0.

- [ ] **Step 3: Visual verification in a real browser**

Ensure dev server is up (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` → `200`; if not, `npm run dev` in background).
Using the Playwright MCP tool: navigate to `http://localhost:3000/lab/review`
and `http://localhost:3000/lab/extract`, take a screenshot of each.
Expected: warm-paper light background (`#F5F2EA`-ish), dark readable text, teal
accents — **no dark/black panels**, visually consistent with `/library` and the
home page. Compare against a screenshot of `http://localhost:3000/` taken in the
same session.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/Evoke && git add components/lab/ReviewSearch.tsx components/lab/LabExtract.tsx components/lab/LabSidebar.tsx components/lab/LabTopBar.tsx && git -c user.email=local -c user.name=local commit -q -m "Convert Lab Review/Extract + chrome to semantic light tokens"
```

---

## Task 4: Live end-to-end verification of both endpoints

**Files:**
- Create: `scripts/lab-endpoints-test.sh`

- [ ] **Step 1: Write the verification script**

Create `scripts/lab-endpoints-test.sh`:

```bash
#!/bin/bash
# Live check: /api/lab/review and /api/lab/extract return well-formed output.
set -e
BASE="http://localhost:3000"

echo "== /api/lab/review =="
curl -s -X POST "$BASE/api/lab/review" -H 'content-type: application/json' \
  -d '{"query":"cognitive behavioral therapy for adult depression","corpus":"s2","limit":6}' \
  | python3 -c "
import json,sys
r=json.load(sys.stdin)
assert 'error' not in r, r
papers=r.get('papers') or []
scr=r.get('screening') or []
assert len(papers)>0, 'no papers'
assert len(scr)==len(papers) or len(scr)>0, f'screening count {len(scr)} vs papers {len(papers)}'
valid={'include','maybe','exclude'}
for s in scr:
    d=s.get('decision'); assert d in valid, f'bad decision {d}'
    assert (s.get('rationale') or '').strip(), 'empty rationale'
print(f'OK: {len(papers)} papers, {len(scr)} screened, criterion={bool(r.get(\"criterion\"))}')
"

echo "== /api/lab/extract =="
# Pull 3 real papers from the review call to feed extract.
PAPERS=$(curl -s -X POST "$BASE/api/lab/review" -H 'content-type: application/json' \
  -d '{"query":"cognitive behavioral therapy for adult depression","corpus":"s2","limit":3}' \
  | python3 -c "import json,sys;print(json.dumps(json.load(sys.stdin).get('papers',[])[:3]))")
curl -s -X POST "$BASE/api/lab/extract" -H 'content-type: application/json' \
  -d "{\"question\":\"Does CBT reduce depression in adults?\",\"papers\":$PAPERS}" \
  | python3 -c "
import json,sys
r=json.load(sys.stdin)
assert 'error' not in r, r
cols=r.get('columns') or []
rows=r.get('rows') or []
assert len(cols)>0, 'no columns'
assert len(rows)>0, 'no rows'
for row in rows:
    assert len(row.get('cells') or [])==len(cols), f'cell/col mismatch: {len(row.get(\"cells\") or [])} vs {len(cols)}'
print(f'OK: {len(cols)} columns, {len(rows)} rows, cells aligned')
"
echo "ALL LAB ENDPOINT CHECKS PASSED"
```

- [ ] **Step 2: Run it against the live server**

Run: `cd ~/Developer/Evoke && bash scripts/lab-endpoints-test.sh`
Expected: prints `OK: ...` for review, `OK: ...` for extract, then
`ALL LAB ENDPOINT CHECKS PASSED`. (Real Claude calls — costs ~$0.05, takes
~30–60s.) If it fails, fix the offending route/agent before continuing; do not
mark done on a failure.

- [ ] **Step 3: Run the full unit suite (no regressions)**

Run: `cd ~/Developer/Evoke && npm test`
Expected: all tests pass, including the two new ones from Tasks 1–2.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/Evoke && git add scripts/lab-endpoints-test.sh && git -c user.email=local -c user.name=local commit -q -m "Add live verification for Lab review/extract endpoints"
```

---

## Self-Review

**Spec coverage:** A (unlock) → Task 1. B (UI parity, 2 tools + chrome) → Tasks
2–3. C (verify endpoints work) → Task 4 + Task 3 Step 3 (UI). D1/D2 are
explicitly deferred to Plans 2 and 3 (spec says phased) — not gaps.

**Placeholder scan:** No TBD/TODO; every code step has full code; the hex
migration is governed by an explicit authoritative mapping table rather than a
vague "replace colors."

**Type consistency:** `Decision` and `decisionStyles` defined in Task 2 are
consumed in Task 3 with the same names; `decisionStyles[d].badge/.row/.label`
match the test in Task 2. Test runner invocation (`npx tsx --test` /
`npm test`) matches `package.json`.

**Known judgment call:** the UI migration enumerates a mapping table + grep/
verify procedure instead of 70 literal before/after diffs — deliberate for a
mechanical color swap; correctness is enforced by Step 2 (zero hex remains +
tsc) and Step 3 (visual screenshot parity).
