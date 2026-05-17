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
