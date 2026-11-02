/* S3PeakOfSum - add the curves before you size, and the peaks pay for each
   other. */

import { slide, scene, together, enter, draw, extend, attr, drive } from "deckkit";
import { WORKLOADS, DAY, DATA, KEY, stackOf, aggregate, qps } from "../sizing.js";

export default {
  id: "S3PeakOfSum",
  label: "Peak of the sum",

  build(svg) {
    const total = DATA.total(WORKLOADS);
    const high = DATA.peakOfSum(WORKLOADS);

    const s = slide(svg, { title: "First, stack the curves hour by hour" });
    const c = s.chart({
      x: DAY,
      y: { data: total, headroom: 1.18 },
      key: KEY,
      keyReverse: true,   // the key reads bottom-up, the way the stack does
    });

    const bands = c.stack(stackOf(WORKLOADS));

    // The aggregate isn't a workload, but it's a series over the same
    // grid, so it draws like one.
    const outline = c.line(DATA.points(aggregate(WORKLOADS)), { ink: "ink", width: 2.4 }).path;

    const level = c.rule(high, { ink: "ink" });
    // Hidden until the line runs: a lone "0" floating over the chart for
    // the first three beats reads as a value. counter() draws it that way.
    const readout = c.counter({ x: c.x(0) + 6, y: c.y(high) - 14, format: qps });

    const say = s.captions([
      `The highest combined peak is ${qps(high)}. That's what you need to provision for.`,
    ]);

    return scene()
      .step(s.open(), c.enter({ at: "<300ms" }))

      // Eight bands assembling is one gesture, not eight gestures with
      // seven pauses wedged between them - hence a stagger rather than a
      // sequence.
      .beat(enter(bands.paths, { from: "below", distance: 16, duration: 0.45, stagger: 0.14 }))

      // The outline is the answer; the line and the figure are the price tag.
      .beat(draw(outline, { duration: 1.8 }))

      .beat(together(
        extend(level.line, level.end, { duration: 1.0 }),
        // attr rather than a CSS opacity tween: AttrPlugin reads back the
        // same attribute svgText() wrote, instead of depending on the
        // presentation attribute being reflected into computed style.
        attr(readout.text, { opacity: 1 }, { duration: 0.3 }),
        drive(readout, high)))

      .beat(say(0))
      .settle(1.0);
  },
};
