import { test } from "node:test";
import assert from "node:assert/strict";
import { pMap } from "../lib/utils/p-map";

test("preserves output order regardless of completion order", async () => {
  // Workers finish in reverse order of input, but results should match input order.
  const result = await pMap([1, 2, 3, 4, 5], 3, async (n, _i) => {
    await new Promise((r) => setTimeout(r, (6 - n) * 5));
    return n * 10;
  });
  assert.deepEqual(result, [10, 20, 30, 40, 50]);
});

test("bounds concurrency", async () => {
  let inFlight = 0;
  let peak = 0;
  await pMap(Array.from({ length: 20 }, (_, i) => i), 4, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return n;
  });
  assert.ok(peak <= 4, `peak concurrency was ${peak}, expected ≤ 4`);
});

test("handles empty input", async () => {
  const result = await pMap([], 3, async () => "anything");
  assert.deepEqual(result, []);
});

test("propagates errors from fn", async () => {
  await assert.rejects(
    pMap([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    }),
    /boom/
  );
});

test("concurrency > items.length is fine", async () => {
  const result = await pMap([1, 2], 10, async (n) => n * 2);
  assert.deepEqual(result, [2, 4]);
});

test("passes index to fn", async () => {
  const result = await pMap(["a", "b", "c"], 2, async (item, i) => `${i}:${item}`);
  assert.deepEqual(result, ["0:a", "1:b", "2:c"]);
});
