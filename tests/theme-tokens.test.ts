import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const VARS = [
  "--c-bg","--c-surface","--c-surface-muted","--c-border","--c-border-strong",
  "--c-teal","--c-teal-hover","--c-teal-light","--c-teal-bright","--c-text","--c-text-muted",
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

const cfg = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");

test("tailwind tokens reference CSS vars with alpha support", () => {
  for (const name of ["c-bg","c-surface","c-surface-muted","c-border","c-border-strong","c-teal","c-teal-hover","c-teal-light","c-teal-bright","c-text","c-text-muted","c-text-faint","c-chip-bg","c-chip-border","c-examples"]) {
    assert.match(cfg, new RegExp("rgb\\(var\\(--" + name + "\\) / <alpha-value>\\)"), `tailwind must map --${name}`);
  }
  assert.doesNotMatch(cfg, /bg:\s*"#F5F2EA"/, "no hardcoded hex token values remain");
});
