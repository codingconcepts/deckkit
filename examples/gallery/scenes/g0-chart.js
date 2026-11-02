/* Chart, annotation and sparklines - the three sizes a line comes in. */

import { slide, scene, together, cascade, draw, enter, compact, hourTick, body } from "deckkit";
import { REGIONS, points } from "../data.js";

export default {
  id: "G0Chart",
  label: "Charts",

  build(svg) {
    const s = slide(svg, {
      title: "One chart, three sizes",
      strap: "chart() with a key, annotate() pointing at a mark, sparkline() with no chrome",
      key: true,
    });

    const c = s.chart({
      x: { domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: hourTick },
      y: { data: REGIONS.flatMap((r) => r.values) },
      key: REGIONS,
      box: { ...s.box, bottom: 430 },
    });

    const lines = c.lines(REGIONS, points, { slot: (r) => r.slot });

    // The peak of the busiest region, pointed at rather than labelled: a
    // label sits beside a mark, an annotation says which mark.
    const busiest = REGIONS[1];
    const peakAt = busiest.values.indexOf(Math.max(...busiest.values));
    const note = s.annotate(c.at(peakAt, busiest.values[peakAt]), {
      text: `${compact(Math.max(...busiest.values))} rps`,
      dx: -120, dy: -44, slot: busiest.slot,
    });

    // The same three series again, small enough to read as shapes.
    const strip = REGIONS.map((region, i) => {
      const x = 180 + i * 320;
      const spark = s.sparkline(points(region), {
        x, y: 500, width: 220, height: 54, slot: region.slot, fill: true, last: true,
      });
      return {
        spark,
        name: body(svg, region.label, 17, "muted", { x, y: 580 }),
      };
    });

    const say = s.captions([
      "The same numbers at three scales. Nothing in the chart knows what it's measuring.",
    ]);

    return scene()
      .step(s.open(), c.enter({ at: "<300ms" }))
      .beat(cascade(lines, "300ms", (l) => draw(l.path, { duration: "800ms" })))
      .beat(note.arrive())
      .beat(cascade(strip, "350ms", (item) =>
        together(enter(item.spark, { from: "below", distance: 10, duration: "500ms" }),
                 enter(item.name, { duration: "500ms" }))))
      .beat(say(0))
      .settle();
  },
};
