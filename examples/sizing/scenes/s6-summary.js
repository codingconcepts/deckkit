/* S6Summary - two things that are true at the same time as the headline. */

import {
  slide, scene, together, enter, exit, extend, fadeTo, morph, percent,
} from "deckkit";
import { WORKLOADS, DAY, DATA, stackOf, withNMinusOne } from "../sizing.js";

export default {
  id: "S6Summary",
  label: "Summary",

  build(svg) {
    const offset = WORKLOADS;
    const aligned = DATA.correlated(offset);

    const s = slide(svg, { title: "Summary" });

    // Tall enough for the correlated stack and for the sum-of-peaks line
    // that lands above it in the second half, so the axis never rescales
    // mid-scene and the two halves stay comparable.
    const c = s.chart({
      x: DAY,
      y: { data: [DATA.peakOfSum(aligned), DATA.sumOfPeaks(offset)], headroom: 1.12 },
      box: { ...s.box, left: 110, right: 880, bottom: 520 },
    });

    const bands = c.stack(stackOf(offset));

    // Two stacks built from the same workload list have identical path
    // structure, so each band tweens from one to the other instead of being
    // cross-faded - the peaks visibly roll onto the same hour.
    const offsetD = c.stackPaths(stackOf(offset));
    const alignedD = c.stackPaths(stackOf(aligned));
    const paths = bands.paths.nodes();

    const points = s.bullets([
      {
        text: "The saving exists because the peaks happen at different times.",
        note: `peaks aligned: saving falls to ${percent(DATA.consolidation(aligned))}`,
        noteStatus: "critical",
      },
      { text: "Peak of the sum is just the demand, buy headroom for unknowns." },
    ], { y: c.box.bottom + 84, pitch: 0 });  // both statements share one slot

    const high = DATA.peakOfSum(offset);
    const provisioned = withNMinusOne(high);  // the S5 outage, as a number

    const demand = c.rule(high, { ink: "ink", label: "peak of the sum" });
    const headroom = c.rule(provisioned, { status: "good", label: "+ N-1 headroom" });
    // Kept on screen above the headroom line: even after paying for a lost
    // node you're still well under sum of the peaks.
    const separate = c.rule(DATA.sumOfPeaks(offset),
                            { status: "critical", label: "sum of the peaks" });

    // A rule arriving: grown from its left end, with its label catching up
    // just before it gets there.
    const land = (r) => [
      extend(r.line, r.end, { duration: 0.9 }),
      fadeTo(r.text, 1, { duration: "500ms", at: "-300ms" }),
    ];

    // Every band rolls at once, or the stack tears.
    const roll = (fromD, toD, duration) =>
      together(...paths.map((p, i) => morph(p, fromD[i], toD[i], { duration })));

    return scene()
      .step(
        s.open(),
        c.enter({ duration: "700ms", at: "<300ms" }),
        enter(bands, { duration: 0.8 }),
        points.show(0))

      // State the caveat, then demonstrate it. Collapsing the stack while
      // the sentence is still being read wastes the only move this scene
      // has. Rolling every peak onto the same hour grows the stack back.
      .beat(roll(offsetD, alignedD, 2.2), points.back(0))

      .beat(
        exit([points.items[0].text, points.items[0].note], { duration: 0.5 }),
        roll(alignedD, offsetD, 1.2),
        points.show(1))

      // One line at a time: demand, then what an outage costs on top of it,
      // then the number both of them still sit under.
      .beat(land(demand))
      .beat(land(headroom))
      .beat(land(separate))
      .settle(1.4);
  },
};
