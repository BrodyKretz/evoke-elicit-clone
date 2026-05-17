# Theme Plan A: Token Infrastructure (dark-first) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the semantic Tailwind tokens theme-aware via CSS variables — `:root` = dark (canonical default), `html.light` = light — so every token-using surface flips correctly, and default the app to dark.

**Architecture:** CSS custom properties (space-separated RGB channels) defined in `globals.css`; Tailwind color tokens point at `rgb(var(--c-*) / <alpha-value>)`; `ThemeToggle` defaults to dark and toggles a `.light` class. No component migration in this plan (that's Plan B).

**Tech Stack:** Next.js 14, Tailwind 3, TypeScript, Node test runner (`npx tsx --test`).

Spec: `docs/superpowers/specs/2026-05-16-app-wide-theme-design.md`

---

## File Structure

- Modify `app/globals.css` — add `:root`/`html.light` var blocks; switch raw `theme()` CSS decls to `rgb(var(--c-*))`.
- Modify `tailwind.config.ts` — token hex literals → `rgb(var(--c-*) / <alpha-value>)`.
- Modify `components/research-agent/ThemeToggle.tsx` — default dark; toggle `.light`; export a pure `resolveInitialTheme`.
- Create `tests/theme-tokens.test.ts` — asserts CSS vars + tailwind references.
- Create `tests/theme-toggle.test.ts` — asserts `resolveInitialTheme` logic.

---

## Task 1: CSS variable palette in globals.css

**Files:** Modify `app/globals.css`; Test `tests/theme-tokens.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/theme-tokens.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const VARS = [
  "--c-bg","--c-surface","--c-surface-muted","--c-border","--c-border-strong",
  "--c-teal","--c-teal-hover","--c-teal-light","--c-text","--c-text-muted",
  "--c-text-faint","--c-chip-bg","--c-chip-border","--c-examples",
];

test("globals.css defines a :root (dark) block with every token var", () => {
  const root = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(root, ":root block must exist");
  for (const v of VARS) assert.match(root[1], new RegExp(v + "\\s*:"), `:root missing ${v}`);
  assert.match(root[1], /--c-bg:\s*15 15 15/, ":root --c-bg must be dark (15 15 15)");
});

test("globals.css defines an html.light block overriding every token var", () => {
  const light = css.match(/html\.light\s*\{([^}]*)\}/);
  assert.ok(light, "html.light block must exist");
  for (const v of VARS) assert.match(light[1], new RegExp(v + "\\s*:"), `html.light missing ${v}`);
  assert.match(light[1], /--c-bg:\s*245 242 234/, "html.light --c-bg must be warm-paper (245 242 234)");
});

test("no raw theme() color calls remain in plain CSS declarations", () => {
  assert.doesNotMatch(css, /background:\s*theme\("colors/, "use rgb(var(--c-*)) not theme() in raw CSS");
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-tokens.test.ts`
Expected: FAIL — no `:root`/`html.light` blocks; theme() still present.

- [ ] **Step 3: Edit `app/globals.css`**

Immediately after the `@tailwind utilities;` line, insert:

```css
:root {
  --c-bg: 15 15 15;
  --c-surface: 31 31 31;
  --c-surface-muted: 42 42 42;
  --c-border: 47 47 47;
  --c-border-strong: 63 63 63;
  --c-teal: 31 110 104;
  --c-teal-hover: 24 86 80;
  --c-teal-light: 20 48 46;
  --c-text: 236 236 236;
  --c-text-muted: 180 180 180;
  --c-text-faint: 142 142 142;
  --c-chip-bg: 42 42 42;
  --c-chip-border: 63 63 63;
  --c-examples: 42 42 42;
}
html.light {
  --c-bg: 245 242 234;
  --c-surface: 255 255 255;
  --c-surface-muted: 250 248 242;
  --c-border: 229 225 214;
  --c-border-strong: 212 207 192;
  --c-teal: 15 92 92;
  --c-teal-hover: 10 74 74;
  --c-teal-light: 232 240 238;
  --c-text: 26 31 31;
  --c-text-muted: 107 114 112;
  --c-text-faint: 156 160 156;
  --c-chip-bg: 240 237 227;
  --c-chip-border: 224 220 206;
  --c-examples: 221 227 222;
}
```

Then in the existing `html, body { … }` rule, replace
`background: theme("colors.bg");` with `background: rgb(var(--c-bg));`
and `color: theme("colors.text.DEFAULT");` with `color: rgb(var(--c-text));`.

In the `.scroll-pane` rules, replace both occurrences of
`theme("colors.border-strong")` (the `scrollbar-color` value and the
`::-webkit-scrollbar-thumb` `background`) with `rgb(var(--c-border-strong))`.

Leave the `@layer components` `@apply` rules unchanged (Tailwind resolves
token utilities through the new vars automatically).

- [ ] **Step 4: Run test, verify pass**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-tokens.test.ts`
Expected: first two tests PASS; third (theme() removed) PASS. (Tailwind-ref test added in Task 2 — not yet.)

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/Evoke && git add app/globals.css tests/theme-tokens.test.ts && git -c user.email=local -c user.name=local commit -q -m "Theme: CSS-variable palette (dark :root + html.light) in globals.css"
```

---

## Task 2: Point Tailwind tokens at the CSS vars

**Files:** Modify `tailwind.config.ts`; Test: extend `tests/theme-tokens.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/theme-tokens.test.ts`:

```ts
const cfg = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");

test("tailwind tokens reference CSS vars with alpha support", () => {
  for (const name of ["c-bg","c-surface","c-surface-muted","c-border","c-border-strong","c-teal","c-teal-hover","c-teal-light","c-text","c-text-muted","c-text-faint","c-chip-bg","c-chip-border","c-examples"]) {
    assert.match(cfg, new RegExp("rgb\\(var\\(--" + name + "\\) / <alpha-value>\\)"), `tailwind must map --${name}`);
  }
  assert.doesNotMatch(cfg, /bg:\s*"#F5F2EA"/, "no hardcoded hex token values remain");
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-tokens.test.ts`
Expected: the new test FAILS (config still has hex literals).

- [ ] **Step 3: Edit `tailwind.config.ts`**

Replace the entire `colors: { … }` object inside `theme.extend` with:

```ts
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--c-surface-muted) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        "border-strong": "rgb(var(--c-border-strong) / <alpha-value>)",
        teal: {
          DEFAULT: "rgb(var(--c-teal) / <alpha-value>)",
          hover: "rgb(var(--c-teal-hover) / <alpha-value>)",
          light: "rgb(var(--c-teal-light) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--c-text) / <alpha-value>)",
          muted: "rgb(var(--c-text-muted) / <alpha-value>)",
          faint: "rgb(var(--c-text-faint) / <alpha-value>)",
        },
        chip: {
          bg: "rgb(var(--c-chip-bg) / <alpha-value>)",
          border: "rgb(var(--c-chip-border) / <alpha-value>)",
        },
        examples: "rgb(var(--c-examples) / <alpha-value>)",
      },
```

Leave `darkMode`, `content`, `fontFamily`, `boxShadow`, `maxWidth` unchanged.

- [ ] **Step 4: Run, verify pass + build**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-tokens.test.ts && npx tsc --noEmit`
Expected: all theme-tokens tests PASS; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/Evoke && git add tailwind.config.ts tests/theme-tokens.test.ts && git -c user.email=local -c user.name=local commit -q -m "Theme: Tailwind tokens reference CSS vars (alpha-aware)"
```

---

## Task 3: ThemeToggle defaults to dark, toggles `.light`

**Files:** Modify `components/research-agent/ThemeToggle.tsx`; Test `tests/theme-toggle.test.ts` (create)

Current behavior: `STORAGE_KEY="evoke.theme"`, `read()` returns stored or
system preference, `apply()` does `classList.toggle("dark", theme==="dark")`.

- [ ] **Step 1: Write failing test**

Create `tests/theme-toggle.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveInitialTheme } from "../components/research-agent/ThemeToggle";

test("defaults to dark when no stored preference", () => {
  assert.equal(resolveInitialTheme(null), "dark");
});
test("respects an explicit stored light", () => {
  assert.equal(resolveInitialTheme("light"), "light");
});
test("stored dark stays dark", () => {
  assert.equal(resolveInitialTheme("dark"), "dark");
});
test("garbage falls back to dark", () => {
  assert.equal(resolveInitialTheme("purple"), "dark");
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-toggle.test.ts`
Expected: FAIL — `resolveInitialTheme` not exported.

- [ ] **Step 3: Edit `components/research-agent/ThemeToggle.tsx`**

Add this exported pure function near the top (after the `Theme` type):

```ts
export function resolveInitialTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}
```

Replace the body of `read()` so it is exactly:

```ts
function read(): Theme {
  if (typeof window === "undefined") return "dark";
  return resolveInitialTheme(window.localStorage.getItem(STORAGE_KEY));
}
```

Replace `apply()` so it toggles the `.light` class instead of `.dark`:

```ts
function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}
```

Leave the component’s render/toggle button and `STORAGE_KEY` persistence
unchanged (it still writes "light"/"dark" to localStorage).

- [ ] **Step 4: Run, verify pass**

Run: `cd ~/Developer/Evoke && npx tsx --test tests/theme-toggle.test.ts && npx tsc --noEmit`
Expected: 4 tests PASS; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/Evoke && git add components/research-agent/ThemeToggle.tsx tests/theme-toggle.test.ts && git -c user.email=local -c user.name=local commit -q -m "Theme: ThemeToggle defaults to dark, toggles .light class"
```

---

## Task 4: Integration verification + no-regression

**Files:** none modified (verification only)

- [ ] **Step 1: Full unit suite**

Run: `cd ~/Developer/Evoke && npm test 2>&1 | grep -E 'ℹ (pass|fail)'`
Expected: all pass, 0 fail (includes the new theme tests).

- [ ] **Step 2: Build + endpoint regression**

Run: `cd ~/Developer/Evoke && npx tsc --noEmit && bash scripts/lab-endpoints-test.sh 2>&1 | tail -1`
Expected: tsc exit 0; final line `ALL LAB ENDPOINT CHECKS PASSED`. (Restart dev server first if needed: it must be running on :3000.)

- [ ] **Step 3: DOM smoke — tokens resolve, default is dark**

Run:
```bash
cd ~/Developer/Evoke && curl -s http://localhost:3000/lab/review | grep -o -e 'bg-bg' -e 'text-text' | sort -u && curl -s http://localhost:3000/ | grep -oc 'class="light"' || echo "no forced .light class on html (correct — dark is default)"
```
Expected: token classes present; the served HTML root does NOT carry a `light` class (default = dark). The 6 hybrid files now get dark via tokens; their leftover `dark:` hex is inert (no `.dark` class is ever set) — Plan C removes it later.

- [ ] **Step 4: Human visual confirmation (explicit — not implementer-claimed)**

Ask the user to hard-reload and screenshot, in BOTH themes (toggle via the
sun/moon button), a representative set: `/lab/review`, `/lab/extract`,
`/research-agent`. Expected: dark by default and consistent; toggling shows
warm-paper light. NOTE: `/library` and `/lab/find` are NOT yet migrated
(Plan B) — they will still look off; that is expected after Plan A.

- [ ] **Step 5: Commit (verification notes only, if any script/docs changed; else skip)**

No code change in this task. If nothing changed, skip the commit.

---

## Self-Review

**Spec coverage:** Spec §1 token infra → Tasks 1–2. §2 ThemeToggle → Task 3.
§5 verification (unit/static/DOM/human) → Task 4. §Decomposition "Plan A" =
this plan exactly. §3/§4/§decision-colors are Plan B/C — intentionally not
here.

**Placeholder scan:** No TBD/TODO; every code step has full literal code and
exact RGB channel values; tests are complete.

**Type consistency:** `resolveInitialTheme(stored: string | null): Theme`
defined in Task 3 Step 3, imported identically in Task 3 Step 1 test. `Theme`
is the existing type in ThemeToggle. The 14 `--c-*` var names are identical
across Task 1 (CSS), Task 2 (tailwind + test), and the spec.

**Known transition note:** the six hybrid files still contain `dark:` hex
after Plan A; with no `.dark` class ever applied they are inert and tokens
(dark by default) drive rendering. Plan C strips them. Verified in Task 4
Step 3.
