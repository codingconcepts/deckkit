/* S2PeaksInTime - build the bill out of eight maxima, and show what that
   throws away.

   The sum-of-peaks half of the argument on its own: the column is assembled
   on screen out of the eight peaks, but only after the curves have shown
   that no two of them happen at the same hour. Adding them is pricing a day
   that never occurs, which is the setup S3 answers. */

import {
  slide, scene, span, together, cascade,
  draw, pop, exit, extend, enter, morph, attr, set, THEME,
} from "deckkit";
import { WORKLOADS, DAY, DATA, KEY, PEAKS, peakSpikes, peakColumn, qps } from "../sizing.js";

export default {
  id: "S2PeaksInTime",
  label: "Summing peaks",

  build(svg) {
    const s = slide(svg, { title: "Summing peaks ignores the clock (and the savings)" });
    const c = s.chart({ x: DAY, y: PEAKS, key: KEY });

    const STACK_TOP = c.box.top + 60;
    const STACK_CX = 520;
    const STACK_W = 135;
    const SPIKE_W = 22;
    const BASELINE = c.box.bottom;

    // Overlaid rather than stacked: this scene is about where each peak
    // lands on the x-axis, which a stack hides behind the band below it.
    // Each curve carries its own fill at zero opacity, ready for the
    // squeeze that turns it into a filled spike.
    const curves = c.lines(WORKLOADS, (w) => DATA.points(w),
                           { slot: (w) => w.slot, width: 1.8, fill: true, fillOpacity: 0 });

    // Every curve under every marker, so all eight lines are drawn before
    // any of the dots.
    const dots = WORKLOADS.map((w) =>
      c.dot([DATA.peakAt(w), DATA.peak(w)], { slot: w.slot }));

    // The two shapes every curve travels through. First squeezed down to
    // its own maximum, still standing at the hour it happens: the eight
    // numbers the bill adds, back on a time axis. Then the clock is taken
    // away and they stack into the bill itself.
    const spikeD = peakSpikes(c.ax, WORKLOADS, { width: SPIKE_W, baseline: BASELINE });
    const stackD = peakColumn(WORKLOADS,
      { cx: STACK_CX, width: STACK_W, top: STACK_TOP, baseline: BASELINE });

    const say = s.captions([
      "One cluster each. Eight peaks, eight different hours.",
      "Sum of the peaks assumes all peaks arrive at the same time.",
    ]);

    // The total, capping the column. In stage pixels rather than through
    // the scales: by the time it's drawn the chart underneath has gone, so
    // there's no axis left to hang it on.
    const cap = span(svg, {
      cx: STACK_CX, width: STACK_W, y: STACK_TOP,
      label: `${qps(DATA.sumOfPeaks(WORKLOADS))}  sum of the peaks`,
    });

    // Squeeze each curve down to its own maximum and fill it in.
    const squeeze = (curve, i) => [
      morph(curve.path, curve.d, spikeD[i], { duration: 1.4 }),
      attr(curve.path, { "fill-opacity": 0.9, "stroke-width": 0 }, { duration: 1.4 }),
    ];

    // Then take the clock away and stack them. A surface-coloured hairline
    // appears only once the spikes are adjacent, where it's doing the job
    // of the gap in a stacked area. The colour is set rather than tweened -
    // the stroke is invisible at width zero anyway, and AttrPlugin
    // interpolates numbers, not paint.
    const stack = (curve, i) => [
      morph(curve.path, spikeD[i], stackD[i], { duration: 2.0 }),
      set(curve.path, { stroke: THEME.surface, "stroke-dasharray": "none" }),
      attr(curve.path, { "stroke-width": THEME.gapWidth }, { duration: 2.0 }),
    ];

    return scene()
      .step(s.open(), c.enter({ at: "<300ms" }))

      .beat(
        cascade(curves, 0.25, (curve) => draw(curve.path, { duration: 0.45 })),
        pop(dots, { duration: 0.5 }),
        say(0))

      // Park on "eight peaks, eight different hours" - that claim is the
      // whole setup, and the squeeze that follows only lands once it has
      // been made.
      .beat(together(
        ...curves.flatMap(squeeze),
        exit(dots, { duration: 0.6 })))

      .beat(
        together(
          ...curves.flatMap(stack),
          // The chart goes, the key stays. It's the only thing left
          // telling you which block is which, so it holds its position
          // while the spikes collapse into the column beside it.
          exit([c.ax, c.grid], { duration: 1.0 })),
        say(1))

      // The bill is assembled but not yet totalled: a good place to let the
      // room look at eight stacked blocks before the number lands on them.
      .beat(
        extend(cap.line, cap.end, { duration: 0.9 }),
        enter(cap.text, { duration: "700ms", at: "<300ms" }))
      .settle(1.6);
  },
};
