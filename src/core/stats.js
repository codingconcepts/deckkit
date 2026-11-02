/* Arithmetic over a set of series sampled on a shared grid.

   None of this is about what the series measure. A series is
   {name, label, slot, values}, the values line up with a shared x grid, and
   these are the operations any deck comparing several of them will want:
   where each one tops out, what they come to together, and the wide shape
   d3.stack needs.

   Bound to the grid once, because every one of them needs it and passing it
   to each call is how the x-axis ends up disagreeing with itself. */

import * as d3 from "d3";

export function stats(xs) {
  const step = xs[1] - xs[0];

  /* The maximum of one series, and where on the grid it happens. */
  const peak = (s) => d3.max(s.values);
  const peakAt = (s) => xs[d3.maxIndex(s.values)];

  /* The minimum, and the mean - the other two figures a caption asks for. */
  const trough = (s) => d3.min(s.values);
  const mean = (s) => d3.mean(s.values);

  /* All of them added together, sample by sample. */
  const total = (list) => xs.map((_, i) => d3.sum(list, (s) => s.values[i]));

  /* One row per sample, one column per series - what d3.stack wants.

     The grid position is held as `x`, so a series named "x" would collide
     with it. That's a fair trade for not threading a key name through
     every caller. */
  const rows = (list) =>
    xs.map((x, i) => {
      const row = { x };
      for (const s of list) row[s.name] = s.values[i];
      return row;
    });

  /* Shift a periodic series by n samples, keeping its period closed.

     A grid inclusive of both ends - midnight appearing twice, once at each
     end of the day - has a duplicate sample, so it's dropped before the
     rotation and put back after it. Rotating the closed array instead would
     walk the seam one sample further into the series on every call. */
  const roll = (s, steps) => {
    const open = s.values.slice(0, -1);
    const n = open.length;
    const rolled = open.map((_, i) => open[(((i - steps) % n) + n) % n]);
    return { ...s, values: [...rolled, rolled[0]] };
  };

  /* Roll a series so that it peaks at `x`. The form every caller actually
     wanted; the sample count is this function's problem, not theirs. */
  const alignTo = (s, x) => roll(s, Math.round((x - peakAt(s)) / step));

  /* The x/y pairs a series draws as. */
  const points = (s) => xs.map((x, i) => [x, s.values[i]]);

  /* The series' own sum, and the sum of their individual maxima: the two
     numbers any "should these share capacity?" argument comes down to. */
  const peakOfSum = (list) => d3.max(total(list));
  const sumOfPeaks = (list) => d3.sum(list, peak);
  const consolidation = (list) => {
    const high = sumOfPeaks(list);
    return high ? (high - peakOfSum(list)) / high : 0;
  };

  return {
    xs, step, peak, peakAt, trough, mean, total, rows, roll, alignTo, points,
    peakOfSum, sumOfPeaks, consolidation,
  };
}
