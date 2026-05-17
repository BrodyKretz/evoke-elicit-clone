# The design system — one theme, two skins, learned the hard way

This section is a confession structured as a lesson. The theming work took far
longer than it should have, because it was attacked as a series of symptoms
before it was attacked as a system. The end state is clean; the path there is
the actual teaching.

## The starting condition

Every component had hardcoded its own hex colors. Some were light
(`bg-white text-[#1F2937]`), some were dark (`bg-[#0F0F0F]`), a handful were
"hybrids" with `light-hex dark:dark-hex` pairs. There was a `ThemeToggle` that
flipped a `.dark` class, but ~28 components didn't respond to it at all. The
result: navigate from one screen to the next and the theme changed under you.
Find papers rendered dark, Library rendered light, a few screens were a broken
mix of both.

## The wrong way (twice)

The first instinct was to fix the screen in front of me. Convert Library to
tokens. Then Find papers. Then Extract. Each fix looked right in isolation and
the app stayed inconsistent, because 20-some other screens were still painting
their own colors. This is whack-a-mole, and the tell is that **the bug count
doesn't go down as you fix bugs** — you're not converging, you're enumerating.

The second wrong turn was subtler: deferring the "strip the dead `dark:`
variants" cleanup as cosmetic. It wasn't cosmetic. Once the system stopped
setting a `.dark` class, every `bg-white dark:bg-[#0F0F0F]` shell rendered
`bg-white` *forever* — the dark half was unreachable. The app chrome was
pinned light while migrated inner components went dark. "Cleanup" turned out
to be load-bearing. Lesson: **a deferral is only safe if you've actually
traced what depends on the thing you're deferring.**

## The right way: tokens as CSS variables

The fix is the standard one, and it should have been step one:

```css
:root            { --c-bg: 15 15 15;  --c-text: 236 236 236; /* …dark = default */ }
html.light       { --c-bg: 245 242 234; --c-text: 26 31 31;  /* …light override */ }
```

```ts
// tailwind.config.ts
colors: { bg: "rgb(var(--c-bg) / <alpha-value>)", text: "rgb(var(--c-text) / <alpha-value>)", … }
```

Now `bg-bg` / `text-text` are *one* class each that resolve correctly in both
themes automatically. The space-separated RGB channel form (`15 15 15`, not
`#0F0F0F`) is deliberate — it preserves Tailwind's `/opacity` modifiers
(`bg-surface/50`) through the variable.

`darkMode: "class"` becomes irrelevant: dark is `:root` (the default — Evoke is
dark-first, matching the reference design), light is a `.light` class the
toggle adds. Every `dark:` variant in the codebase is now dead and gets
stripped. Migration is then mechanical: replace each hardcoded hex with the
token that matches its *role* (page → `bg-bg`, panel → `bg-surface`, primary
text → `text-text`, …), guided by one authoritative hex→token table, file by
file, until `grep` for hardcoded hex returns nothing.

## The contrast trap (the part nobody warns you about)

Migrating to tokens introduced a *new* class of bug that hardcoding had masked.
The brand teal (`#1F6E68`) was chosen to sit on *light* backgrounds. The
moment a teal heading or active-nav icon rendered on the dark default surface,
contrast collapsed to ~2.5:1 — technically present, functionally invisible. The
same trap recurred for `bg-teal-light` (a near-black teal in dark mode) with
teal text on it, and for `bg-rose-50/50` error banners (fine on light,
invisible on dark).

The wrong fix is to spot-correct each occurrence. The right fix is more
tokens — accent tokens with theme-aware values:

- `text-teal-bright` — a bright mint in dark, the normal teal in light. Used
  for every teal text/icon accent on a neutral surface.
- `error` / `error-bg`, `warning` / `warning-bg` — danger and caution colors
  that actually flip per theme, instead of raw Tailwind palette classes that
  don't.

Same lesson a third time: when the same defect shows up in N places, the fix
belongs in the token layer, not in N components.

## Verifying a thing you can't see

A practical constraint shaped the whole effort: the browser automation
segfaulted on the dev machine, so pixel verification was impossible from the
agent side. The workaround became a discipline worth keeping:

- **Code-level proof:** `grep` asserting zero hardcoded hex and zero `dark:`
  remain; `tsc`; the unit suite.
- **DOM-level proof:** `curl` the rendered route, confirm token classes are
  emitted and the compiled CSS actually references `var(--c-*)`.
- **Contrast proof:** a reviewer pass that computes the actual contrast ratio
  of every same-surface bg/text pair in the diff — this is what caught the
  invisible-teal bugs every single time, before a human ever looked.
- **Human proof:** the user screenshots a representative set in both themes.
  Stated explicitly as the only real acceptance gate; never claimed as done
  from the agent side.

The general principle: when you can't observe the output directly, build a
ladder of cheaper proxies that each catch a different failure mode, and be
honest that the top rung is still someone else's eyeballs.

## Where it landed

One token system. `:root` dark, `html.light` light, every component on tokens,
zero hardcoded hex outside intentional fixed palettes (the include/maybe/
exclude decision pills, which read on both themes by design). Adding a screen
now means using tokens and it themes itself. The known residue is documented,
not hidden: a brief dark flash if a returning user has a stored light
preference (no SSR inline theme script), itemized in *Where Evoke falls short*.
