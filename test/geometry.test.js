/* Path arithmetic, and one invariant that holds the morphs up.

   d3.interpolateString interpolates two path strings by walking the numbers
   in them. Give it two shapes with different point counts or different
   command sequences and it doesn't fail - it produces a tween that is
   nonsense for the middle 80% and correct at both ends, which is the
   hardest kind of bug to catch by watching a deck. So the point counts get
   assertions.

   The rest is here because a path is the one thing in the library you
   can't eyeball: a wrong arc flag looks like a design decision. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  rectPerimeter, polyline, blockPath, dodge, roundRect, elbow, arrowHead,
} from "../src/core/geometry.js";

// The command letters of a path, in order: "MLLLZ" and so on. Two shapes
// morph cleanly if and only if these match.
const commands = (d) => d.replace(/[^A-Za-z]/g, "");
const numbers = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);

test("rectPerimeter returns exactly the point count asked for", () => {
  for (const n of [2, 5, 24, 97]) {
    assert.equal(rectPerimeter(n, 0, 0, 100, 50).length, n, `n = ${n}`);
  }
});

test("rectPerimeter starts and finishes on the same corner", () => {
  const points = rectPerimeter(40, 10, 20, 110, 70);
  assert.deepEqual(points.at(0), [10, 70], "bottom-left");
  assert.deepEqual(points.at(-1), points.at(0), "closed");
});

test("every rectPerimeter point is on the rectangle", () => {
  const [x0, y0, x1, y1] = [10, 20, 110, 70];
  for (const [x, y] of rectPerimeter(64, x0, y0, x1, y1)) {
    const onVertical = Math.abs(x - x0) < 1e-9 || Math.abs(x - x1) < 1e-9;
    const onHorizontal = Math.abs(y - y0) < 1e-9 || Math.abs(y - y1) < 1e-9;
    assert.ok(onVertical || onHorizontal, `(${x}, ${y}) is off the edge`);
    assert.ok(x >= x0 - 1e-9 && x <= x1 + 1e-9, `${x} is in range`);
    assert.ok(y >= y0 - 1e-9 && y <= y1 + 1e-9, `${y} is in range`);
  }
});

test("rectPerimeter walks at equal arc length", () => {
  // Not merely "n points somewhere on the edge": bunched points interpolate
  // into a shape that bulges on one side as it morphs.
  const points = rectPerimeter(49, 0, 0, 100, 50);
  const steps = points.slice(1).map(([x, y], i) =>
    Math.hypot(x - points[i][0], y - points[i][1]));
  const expected = (2 * 100 + 2 * 50) / (points.length - 1);
  for (const step of steps) assert.ok(Math.abs(step - expected) < 1e-9, `${step} vs ${expected}`);
});

test("polyline is one move and the rest lines, at two decimals", () => {
  assert.equal(polyline([[0, 0], [1.236, 2], [3, 4.129]]), "M0.00,0.00L1.24,2.00L3.00,4.13");
});

test("a block and a curve of the same sample count morph cleanly", () => {
  // The invariant the whole file exists for. Same commands, same number of
  // numbers - so d3.interpolateString has a pairwise job and not a guess.
  const n = 25;
  const curve = polyline(Array.from({ length: n }, (_, i) => [i * 4, 60 + Math.sin(i) * 20]));
  const block = blockPath(n, { x0: 0, y0: 10, x1: 96, y1: 110 });

  assert.equal(commands(block), commands(curve));
  assert.equal(numbers(block).length, numbers(curve).length);
  assert.equal(commands(block), `M${"L".repeat(n - 1)}`);
});

test("blockPath takes the {x0, y0, x1, y1} the layout helpers hand back", () => {
  const r = { x0: 0, y0: 10, x1: 96, y1: 110 };
  assert.equal(blockPath(8, r), polyline(rectPerimeter(8, r.x0, r.y0, r.x1, r.y1)));
});

test("dodge leaves marks that already clear each other alone", () => {
  assert.deepEqual(dodge([0, 100, 250], 10), [0, 100, 250]);
  assert.deepEqual(dodge([], 10), []);
  assert.deepEqual(dodge([42], 10), [42]);
});

test("dodge spreads a pile-up by exactly the gap", () => {
  const out = dodge([100, 100, 100], 10);
  assert.deepEqual(out, [90, 100, 110]);
});

test("dodge keeps each cluster on its own centre", () => {
  // The nudge is a legibility fix, not a reading: a mark must not end up
  // somewhere materially different on the axis.
  const input = [40, 42, 44, 300, 301];
  const out = dodge(input, 10);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(Math.abs(mean(out.slice(0, 3)) - mean(input.slice(0, 3))) < 1e-9, "first cluster");
  assert.ok(Math.abs(mean(out.slice(3)) - mean(input.slice(3))) < 1e-9, "second cluster");
});

test("dodge answers in the order it was asked, not in sorted order", () => {
  // The i-th position belongs to the i-th datum; sorting the output would
  // silently relabel every column.
  assert.deepEqual(dodge([100, 0, 100], 10), [95, 0, 105]);
});

test("roundRect closes, and clamps its radius to the box", () => {
  const big = roundRect(0, 0, 20, 10, 50);
  assert.ok(big.endsWith("Z"), "closed");
  // r is capped at half the short side, so an over-large radius gives a
  // stadium rather than a path that folds through itself.
  assert.ok(!numbers(big).some((v) => v < 0), `no negative coordinates in ${big}`);
  assert.equal(commands(roundRect(0, 0, 100, 50, 6)), commands(big), "same commands either way");
});

test("elbow turns once, on the wider axis", () => {
  const wide = elbow([0, 0], [200, 40]);
  const tall = elbow([0, 0], [40, 200]);
  assert.ok(wide.startsWith("M0,0H"), "a wide gap leaves horizontally");
  assert.ok(tall.startsWith("M0,0V"), "a tall one leaves vertically");
});

test("elbow takes an explicit bend over the wider axis", () => {
  assert.ok(elbow([0, 0], [200, 40], { bend: "v" }).startsWith("M0,0V"));
  assert.ok(elbow([0, 0], [40, 200], { bend: "h" }).startsWith("M0,0H"));
});

test("elbow degenerates to a straight line rather than a zero-radius turn", () => {
  // Boxes in a row are the common case, and a turn with no room to turn in
  // renders as a notch.
  assert.equal(elbow([0, 50], [200, 50]), "M0,50L200,50");
  assert.equal(elbow([50, 0], [50, 200]), "M50,0L50,200");
});

test("arrowHead is a closed triangle at the point it's given", () => {
  const d = arrowHead([100, 50], 0);
  assert.equal(commands(d), "MLLZ");
  assert.ok(d.startsWith("M100,50"), "the tip is the point");
  // Aimed along +x, so both wings sit behind the tip and straddle its line.
  const [, , ax, ay, bx, by] = numbers(d);
  assert.ok(ax < 100 && bx < 100, "wings trail the tip");
  assert.ok(Math.abs((ay + by) / 2 - 50) < 1e-9, "and are symmetric about the aim");
});

test("arrowHead turns with its angle", () => {
  const right = numbers(arrowHead([0, 0], 0));
  const down = numbers(arrowHead([0, 0], Math.PI / 2));
  assert.notDeepEqual(right, down);
  // Rotated a quarter turn, the wings that trailed in -x now trail in -y.
  const [, , , ay, , by] = down;
  assert.ok(ay < 0 && by < 0, "wings trail upwards when aiming down the screen");
});
