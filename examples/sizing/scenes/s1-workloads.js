/* S1Workloads - eight workloads on one shared scale, each peaking elsewhere.

   The scale is the argument. Eight charts that each pick their own y-max
   would show eight identically-shaped humps and prove nothing; facets()
   computes one domain across all of them and won't let a facet have its
   own. */

import { slide, scene, clock } from "deckkit";
import { WORKLOADS, DAY, DATA, qps } from "../sizing.js";

export default {
  id: "S1Workloads",
  label: "Eight workloads",

  build(svg) {
    const s = slide(svg, { title: "Eight workloads, same 24h period." });

    const small = s.facets(WORKLOADS, {
      cols: 4,
      x: DAY,
      points: (w) => DATA.points(w),
      slot: (w) => w.slot,
      name: (w) => w.label,
      marker: (w) => [DATA.peakAt(w), DATA.peak(w)],
      note: (w) => `${qps(DATA.peak(w))} at ${clock(DATA.peakAt(w))}`,
    });

    const say = s.captions(["Same scale. Different peaks, at different hours."]);

    // One hold per workload. This is the scene with eight things to say and
    // eight pictures to say them over, so each facet lands and then waits -
    // which is what .beats() is, and the reason the video cut this scene
    // with five seconds of silence after each one.
    return scene()
      .step(s.open())
      .step(small.beats())
      .beat(say(0))
      .settle();
  },
};
