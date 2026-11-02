/* Boxes and arrows, a list of claims, and a number to end on.

   Also the three glyph shapes side by side: letters on the edge, an image
   on the queue, an inlined path on the two databases. */

import { slide, scene, GLYPHS, percent } from "deckkit";
import { BADGE_IMAGE } from "../data.js";

export default {
  id: "G2Flow",
  label: "Flow",

  build(svg) {
    const s = slide(svg, {
      title: "Where the writes go",
      strap: "flow() lays the boxes out and derives the arrows from the links",
      box: { left: 86, right: 1194, top: 150, bottom: 420 },
    });

    const path = s.flow({
      nodes: [
        { label: "Edge", sub: "3 regions", glyph: GLYPHS.letters("E") },
        { label: "Queue", sub: "at-least-once", glyph: BADGE_IMAGE },
        { label: "Primary", sub: "7 nodes", glyph: GLYPHS.disc },
        { label: "Reporting", sub: "read replica", glyph: GLYPHS.disc },
      ],
      links: [
        [0, 1, { label: "writes" }],
        [1, 2],
        [2, 3, { label: "changefeed", dashed: true, status: "good" }],
      ],
    });

    const points = s.bullets([
      { text: "The queue is the throughput ceiling.",
        note: "and the only place back-pressure can be applied" },
      { text: "Reporting reads a replica." },
    ], { y: 500 });

    const verdict = s.stat({
      value: percent(0.993),
      lines: ["of writes land inside 40ms"],
      cx: 960, cy: 545, size: 72,
    });

    return scene()
      .step(s.open())
      .beat(path.all())
      .beat(points.show(0))
      .beat(points.back(0))
      .beat(points.show(1))
      .beat(verdict.enter())
      .settle();
  },
};
