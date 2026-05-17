# The Lab surface — tools that compose into workflows

The first nine sections describe Evoke as a *pipeline*: one research question
in, one synthesized report out. That's the **Report workflow**, and it's the
headline. But Elicit's actual product shape is subtler, and Evoke grew to match
it: the pipeline stages are also usable **as standalone tools**, independent of
a full run. That second surface is the Lab.

## Two surfaces over the same agents

```
                 ┌─────────────────────────────────────────┐
   Report flow   │  gather → screen → extract → synthesize  │  one question → one report
                 └─────────────────────────────────────────┘
                        │        │         │
                        ▼        ▼         ▼            each agent, called directly:
                 ┌──────────┬──────────┬──────────────────────────────────────┐
   Lab tools     │ Find     │ System.  │ Extract data  · Chat · Import ·       │
                 │ papers   │ review   │ Trials · Notebook · Library           │
                 └──────────┴──────────┴──────────────────────────────────────┘
```

Nothing in the Lab is a new agent. **Find papers** is the gather stage with a
UI. **Systematic review** is gather + screen, stopping before extraction.
**Extract data** is the extraction agent pointed at an arbitrary paper set
instead of the screened residue of a run. **Chat with papers** is the same
scoped-Opus assistant the report sidebar uses, just over a hand-picked set.
The agents didn't change; the *entry points* multiplied.

This is the most important product-architecture observation in the whole
build: **because each stage already had a typed contract and was independently
runnable (section 2), exposing it as a standalone tool was almost free.** The
data-contract investment paid a second dividend nobody planned for.

## The Library is the connective tissue

Standalone tools need a place to put papers between them. That's the
**Library**: a persistent, browser-local store (`lib/library.ts`,
localStorage, deduped by `paper.id`) that any tool can write to and any tool
can read from.

The flow the user actually wants:

1. **Find papers** → search → "Save to library" on the ones worth keeping.
2. **Extract data** → pick from the Library (or the in-session selection) →
   run extraction on exactly those.
3. **Library** → review everything saved across runs, export CSV.

Evoke briefly had a bug-shaped version of this: Extract read from a *separate*
"lab selection" store while Find papers wrote to the Library — two parallel
buckets, so saving a paper in one place didn't make it appear in the other.
The fix was to make Extract draw from **both** sources, deduped, with a
checkbox picker that tags each paper's origin ("Library" / "Selection" /
"Both"). The lesson is mundane and universal: when two tools share state,
they must share *the same* state, not two stores that happen to look alike.

## Editable extraction columns

In the Report flow, the extraction agent auto-generates four columns from the
question. The standalone **Extract data** tool keeps that as the *default* but
lets the user rename, add, and remove columns and re-run — which is Elicit's
actual Extract behavior ("custom **or** AI-generated columns"). The agent never
needed changing: `extractPapers` always accepted a `columns: string[]`
argument; the only thing pinning it to four was a `COLUMN_COUNT = 4` constant
and the absence of a UI. Removing the constant and adding the editor was the
whole feature. A recurring shape in this codebase: the capability was latent in
the contract; the work was surfacing it.

## LabShell — the thing that makes them feel like one app

A standalone tool is just a component. Rendered bare, it's a form floating in a
void with no navigation — which is exactly how `/lab/extract` and
`/lab/review` first shipped, and it looked broken. `LabShell`
(`components/lab/LabShell.tsx`) wraps every Lab tool in the same persistent
left sidebar + top bar the Report workflow uses, reusing the `Sidebar`/`TopBar`
components rather than duplicating them. The sidebar *is* the back-navigation;
there is no per-tool back button because there doesn't need to be one — every
destination is one click away in the rail that's always there.

The takeaway worth stealing: **a "tool" isn't done when its logic works; it's
done when it's reachable and leaveable like every other screen.** Consistency
of chrome is a feature, not polish.

## What the Lab is not

It is still not a separate agent system. There is no Lab-specific model, no
Lab-specific prompt. Every tool is a thin route + a component over an agent
that already existed for the Report pipeline. If you remember one thing from
this section: the second product surface cost a fraction of the first because
the first was built with typed, isolated, re-runnable stages. Design for that
property and you get the composable version of your product nearly for free.
