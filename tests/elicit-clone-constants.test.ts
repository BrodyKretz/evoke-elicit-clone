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
