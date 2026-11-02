/* Series arithmetic, which is the other place a deck lies convincingly.

   A chart drawn off a wrong sum looks exactly like a chart drawn off a
   right one - the shape is plausible, the axis agrees with itself, and the
   only tell is the number in the caption. peakOfSum against sumOfPeaks is
   the whole argument of a consolidation deck, so it gets assertions. */

import test from "node:test";
import assert from "node:assert/strict";

import { stats } from "../src/core/stats.js";

// A five-sample day on a closed grid: midnight appears at both ends.
const xs = [0, 6, 12, 18, 24];
const S = stats(xs);

const at6 = { name: "a", values: [0, 10, 0, 0, 0] };
const at12 = { name: "b", values: [0, 0, 10, 0, 0] };

test("the grid step is read off the grid", () => {
  assert.equal(S.step, 6);
  assert.deepEqual(S.xs, xs);
});

test("peak, trough and mean of one series", () => {
  assert.equal(S.peak(at6), 10);
  assert.equal(S.trough(at6), 0);
  assert.equal(S.mean(at6), 2);
});

test("peakAt answers in grid units, not indices", () => {
  assert.equal(S.peakAt(at6), 6);
  assert.equal(S.peakAt(at12), 12);
});

test("total adds sample by sample", () => {
  assert.deepEqual(S.total([at6, at12]), [0, 10, 10, 0, 0]);
});

test("rows is the wide shape d3.stack wants", () => {
  assert.deepEqual(S.rows([at6, at12]), [
    { x: 0, a: 0, b: 0 },
    { x: 6, a: 10, b: 0 },
    { x: 12, a: 0, b: 10 },
    { x: 18, a: 0, b: 0 },
    { x: 24, a: 0, b: 0 },
  ]);
});

test("points pairs each value with its grid position", () => {
  assert.deepEqual(S.points(at12), [[0, 0], [6, 0], [12, 10], [18, 0], [24, 0]]);
});

test("roll shifts the series and keeps the period closed", () => {
  const rolled = S.roll(at6, 1);
  assert.deepEqual(rolled.values, [0, 0, 10, 0, 0]);
  // The duplicate sample is still a duplicate: a seam that drifts open is
  // the bug this function's slice/append dance exists to prevent.
  assert.equal(rolled.values.at(0), rolled.values.at(-1));
});

test("roll carries the series' other fields through", () => {
  const s = { name: "a", label: "Region A", slot: 3, values: at6.values };
  const rolled = S.roll(s, 2);
  assert.equal(rolled.name, "a");
  assert.equal(rolled.label, "Region A");
  assert.equal(rolled.slot, 3);
});

test("rolling a full period is the identity, because the seam doesn't walk", () => {
  // Four open samples on a five-sample closed grid. Rolling four times by
  // one has to land back on the original, or every alignTo() in a deck is
  // one sample further out than the last.
  let s = at6;
  for (let i = 0; i < 4; i++) s = S.roll(s, 1);
  assert.deepEqual(s.values, at6.values);
  assert.deepEqual(S.roll(at6, 4).values, at6.values);
});

test("roll takes a negative shift", () => {
  assert.deepEqual(S.roll(at12, -1).values, [0, 10, 0, 0, 0]);
});

test("alignTo puts the peak where it's asked to", () => {
  for (const x of [0, 6, 12, 18]) {
    assert.equal(S.peakAt(S.alignTo(at6, x)), x, `aligned to ${x}`);
  }
});

test("alignTo preserves the shape, not just the maximum", () => {
  const moved = S.alignTo(at6, 18);
  assert.equal(S.peak(moved), S.peak(at6));
  assert.equal(S.mean(moved), S.mean(at6));
});

test("peakOfSum isn't sumOfPeaks when the peaks are at different hours", () => {
  // The entire argument of a consolidation deck, in three assertions.
  assert.equal(S.sumOfPeaks([at6, at12]), 20);
  assert.equal(S.peakOfSum([at6, at12]), 10);
  assert.equal(S.consolidation([at6, at12]), 0.5);
});

test("peaks that coincide consolidate to nothing", () => {
  assert.equal(S.peakOfSum([at6, at6]), 20);
  assert.equal(S.sumOfPeaks([at6, at6]), 20);
  assert.equal(S.consolidation([at6, at6]), 0);
});

test("consolidation of nothing is zero, not NaN", () => {
  // A deck that renders "NaN%" in 48pt is worse than one that renders 0%.
  assert.equal(S.consolidation([]), 0);
  assert.equal(S.consolidation([{ name: "flat", values: [0, 0, 0, 0, 0] }]), 0);
});
