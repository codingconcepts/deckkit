/* The landmarks, and the arithmetic that derives boxes from them.

   layout.js is the file that exists so magic numbers don't drift, which
   makes it exactly the file where a drifting number is hardest to see: a
   grid one gap out still looks like a grid. These assertions pin the
   landmarks and the invariants - boxes fill their region, rows sit inside
   it, stacks reach their baseline - rather than every derived pixel. */

import test from "node:test";
import assert from "node:assert/strict";

import { W } from "../src/core/stage.js";
import {
  MARGIN, SLOT, region, keyAnchor, centreOf, tile, grid, row, fitRow,
  stackColumn, columnsAt,
} from "../src/core/layout.js";

// Pixel arithmetic, so exact equality is usually right; these are for the
// places a division leaves a tail.
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test("the landmarks are in reading order, top to bottom", () => {
  // Not a tautology: a strapline baseline below the top of the drawing
  // region is a strapline with a chart through it.
  const order = [SLOT.title, SLOT.strap, SLOT.top, SLOT.bottom, SLOT.caption, SLOT.footnote];
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i] > order[i - 1], `slot ${i} is below slot ${i - 1}`);
  }
});

test("the default region is the stage less its margins", () => {
  assert.deepEqual(region(), { left: 86, right: W - 86, top: SLOT.top, bottom: SLOT.bottom });
});

test("a key reserves the gutter off the right edge only", () => {
  const box = region({ key: true });
  assert.equal(box.right, W - MARGIN.right - MARGIN.gutter);
  // The left edge is the point: a slide with a legend and a slide without
  // one still start their frame in the same place.
  assert.equal(box.left, region().left);
});

test("no strapline reclaims its band", () => {
  assert.equal(region({ strap: false }).top, SLOT.top - 40);
  assert.equal(region({ strap: false }).bottom, SLOT.bottom);
});

test("an explicit top or bottom wins", () => {
  assert.deepEqual(region({ top: 200, bottom: 500 }), { left: 86, right: 1194, top: 200, bottom: 500 });
  // Zero is a position, not an absence - `??` rather than `||`.
  assert.equal(region({ top: 0 }).top, 0);
});

test("keyAnchor sits beside the region it labels", () => {
  const box = region({ key: true });
  assert.deepEqual(keyAnchor(box), { x: box.right + 40, y: box.top + 20 });
});

test("centreOf is the middle of a box", () => {
  assert.deepEqual(centreOf(region()), { cx: 640, cy: 375 });
});

test("tile returns boxes in reading order, across then down", () => {
  const boxes = tile(5, { left: 0, top: 0, width: 100, height: 50, cols: 3, gap: 10, pitch: 60 });
  assert.equal(boxes.length, 5);
  assert.deepEqual(boxes.map((b) => b.left), [0, 110, 220, 0, 110]);
  assert.deepEqual(boxes.map((b) => b.top), [0, 0, 0, 60, 60]);
});

test("each tile carries its own centre", () => {
  const [b] = tile(1, { left: 20, top: 40, width: 100, height: 50, cols: 1 });
  assert.deepEqual(
    { left: b.left, right: b.right, top: b.top, bottom: b.bottom, cx: b.cx, cy: b.cy },
    { left: 20, right: 120, top: 40, bottom: 90, cx: 70, cy: 65 },
  );
});

test("a centred grid is centred on its columns, not on its items", () => {
  // Two items in a four-column grid start where four items would, so a
  // short last row doesn't drag the whole grid sideways.
  const four = tile(4, { top: 0, width: 100, height: 50, cols: 4, gap: 0, centre: true });
  const two = tile(2, { top: 0, width: 100, height: 50, cols: 4, gap: 0, centre: true });
  assert.equal(two[0].left, four[0].left);
  assert.equal(four[0].left, (W - 400) / 2);
});

test("grid fills its region exactly", () => {
  const box = region();
  const boxes = grid(4, { box, cols: 2 });
  near(boxes[0].left, box.left, "first column starts at the region");
  near(boxes[1].right, box.right, "last column finishes at it");
  near(boxes[0].top, box.top, "first row starts at the top");
  near(boxes.at(-1).bottom, box.bottom, "last row finishes at the floor");
});

test("grid leaves the gap it was given between columns", () => {
  const boxes = grid(4, { box: region(), cols: 2, gap: 42 });
  near(boxes[1].left - boxes[0].right, 42, "column gap");
});

test("grid picks the column count nearest 16:9", () => {
  // Eight small multiples go 3/3/2 rather than 4/4: the tiles come out
  // closer to the aspect the eye just saw the full-size chart in.
  const cols = (n) => { const g = grid(n); return g.filter((b) => b.top === g[0].top).length; };
  assert.equal(cols(8), 3);
  assert.equal(cols(2), 2);
});

test("grid's label band comes off the top of every tile", () => {
  const box = region();
  const boxes = grid(2, { box, cols: 2, label: 30 });
  near(boxes[0].top, box.top + 30, "tiles start below the label");
  near(boxes[0].bottom, box.bottom, "and still finish on the floor");
});

test("row centres n slots on the stage", () => {
  const boxes = row(3, { width: 100, gap: 20, cy: 300 });
  near((boxes[0].left + boxes.at(-1).right) / 2, W / 2, "row midpoint");
  assert.deepEqual(boxes.map((b) => b.cy), [300, 300, 300]);
});

test("fitRow fills the width it's given", () => {
  const box = region();
  const boxes = fitRow(4, { box });
  near(boxes[0].left, box.left, "starts at the region");
  near(boxes.at(-1).right, box.right, "finishes at it");
});

test("fitRow keeps the gap at its fraction of the slot", () => {
  const boxes = fitRow(4, { box: region(), ratio: 0.5 });
  const width = boxes[0].right - boxes[0].left;
  near(boxes[1].left - boxes[0].right, width * 0.5, "gap is half a slot");
});

test("fitRow centres inside an asymmetric region, not on the stage", () => {
  // The whole reason region({key: true}) narrows the box. A row that sizes
  // itself to the gutter-less width and then centres on the stage lays
  // itself out straight across the key.
  const box = region({ key: true });
  const boxes = fitRow(4, { box });
  near(boxes[0].left, box.left, "starts at the region");
  near(boxes.at(-1).right, box.right, "and stops short of the gutter");
  near((boxes[0].left + boxes.at(-1).right) / 2, centreOf(box).cx, "midpoint is the box centre");
});

test("fitRow caps the slot width and keeps the row centred", () => {
  // Three slots would fit 277 wide; max says a node is 120 and no wider,
  // which is the case cluster() and flow() are in on every slide.
  const box = region();
  const boxes = fitRow(3, { box, max: 120, ratio: 0.5 });
  assert.equal(boxes[0].right - boxes[0].left, 120);
  near(boxes[1].left - boxes[0].right, 60, "the gap scales with the capped slot");
  near((boxes[0].left + boxes.at(-1).right) / 2, centreOf(box).cx, "still centred when capped");
  assert.ok(boxes[0].left > box.left, "and narrower than the region");
});

test("fitRow takes an explicit centreline", () => {
  assert.deepEqual(fitRow(2, { box: region(), cy: 420 }).map((b) => b.cy), [420, 420]);
});

test("stackColumn stacks bottom-up, in proportion", () => {
  const slices = stackColumn([1, 1, 2], { cx: 100, width: 40, top: 0, baseline: 400 });
  // First value sits on the baseline; the last reaches the top.
  assert.equal(slices[0].y1, 400);
  assert.equal(slices.at(-1).y0, 0);
  assert.deepEqual(slices.map((s) => s.y1 - s.y0), [100, 100, 200]);
  assert.deepEqual(slices.map((s) => [s.x0, s.x1]), [[80, 120], [80, 120], [80, 120]]);
});

test("stackColumn fills the span exactly, whatever the values", () => {
  const top = 150;
  const baseline = 600;
  const slices = stackColumn([3, 7, 11, 0.5], { cx: 0, width: 10, top, baseline });
  near(slices.reduce((sum, s) => sum + (s.y1 - s.y0), 0), baseline - top, "heights sum to the span");
  near(slices.at(-1).y0, top, "and the last one lands on the top");
});

test("stackColumn of nothing is flat, not NaN", () => {
  // A zero total divides; the column just has no height.
  const slices = stackColumn([0, 0], { cx: 100, width: 40, top: 0, baseline: 400 });
  assert.deepEqual(slices.map((s) => s.y0), [400, 400]);
  assert.deepEqual(slices.map((s) => s.y1), [400, 400]);
});

test("columnsAt stands columns on their own positions", () => {
  const cols = columnsAt([200, 600], [50, 60], { width: 40, baseline: 400 });
  assert.deepEqual(cols, [
    { x0: 180, x1: 220, y0: 50, y1: 400 },
    { x0: 580, x1: 620, y0: 60, y1: 400 },
  ]);
});

test("columnsAt spreads columns that would hide behind each other", () => {
  // A scene captioned "two of them" has to show two.
  const cols = columnsAt([100, 100], [50, 60], { width: 40, baseline: 400 });
  assert.ok(cols[0].x1 <= cols[1].x0, "they no longer overlap");
  // Symmetric about the real position, so nothing moves to a different
  // place on the axis.
  near((cols[0].x0 + cols[1].x1) / 2, 100, "centre of the pair");
});
