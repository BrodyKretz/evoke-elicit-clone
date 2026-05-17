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
    assert.doesNotMatch(s.badge + s.row, /#0D0D0D|#2A2A2A|#ECECEC/);
  }
});
