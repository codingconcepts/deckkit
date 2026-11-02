/* S4Verdict - the two numbers, side by side, and what sits between them. */

import { slide, scene, grow, enter, percent } from "deckkit";
import { WORKLOADS, DATA, qps } from "../sizing.js";

export default {
  id: "S4Verdict",
  label: "Before and after",

  build(svg) {
    const high = DATA.sumOfPeaks(WORKLOADS);
    const low = DATA.peakOfSum(WORKLOADS);

    const s = slide(svg, { title: "Before and after" });

    // Two columns and the delta between them. The taller one sets the
    // scale for everything else, including the block of unused capacity
    // stacked on top of the shorter one.
    const { tall, short, gap, label } = s.comparison({
      high, highLabel: "sum of the peaks",
      low, lowLabel: "peak of the sum",
      gapLabel: `${qps(high - low)} never used`,
    });

    const verdict = s.stat({
      value: percent(DATA.consolidation(WORKLOADS)),
      lines: ["of provisioned capacity,", "bought and never used"],
      cx: 946,
    });

    // grow() is scaleY against a bottom origin rather than a height tween -
    // it keeps the figure and caption underneath the bar still.
    const raise = (col) => [grow(col.bar), enter([col.figure, col.caption], { duration: 0.5 })];

    // One column at a time. The whole scene is a comparison, and a
    // comparison needs the first number to have landed before the second.
    return scene()
      .step(s.open(), raise(tall))
      .beat(raise(short))
      .beat(enter([gap, label], { duration: 0.8 }))
      .beat(verdict.enter())
      .settle(1.4);
  },
};
