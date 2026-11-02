/* Small multiples: the same chart, n times, on one scale.

   The scale is the whole reason this is a component rather than a loop. A
   grid of charts that each pick their own y-max isn't a comparison, it is
   n unrelated pictures arranged neatly - and the loop that builds them by
   hand is exactly where that goes wrong, because `d3.max` of one series is
   the obvious thing to write inside a `.map`.

   So facets() takes the items, computes one domain across all of them, and
   refuses to let a facet have its own. Everything else - the tiling, the
   name above, the figure below, the arrival - follows from that. */

import * as d3 from "d3";
import { body } from "../core/stage.js";
import { region, grid as gridOf } from "../core/layout.js";
import { compact } from "../core/format.js";
import { headroom } from "../marks/plot.js";
import { plot, gridlines } from "../marks/plot.js";
import { series, marker } from "../marks/series.js";
import { together, after, beats as beatsOver, cascade } from "../anim/combinators.js";
import { enter, draw, pop } from "../anim/steps.js";

export function facets(parent, items, opts = {}) {
  const {
    box = region(), cols, gap = 42, rowGap, label = 26,
    x = {}, y = {},
    points,
    name,
    note,
    slot = (_, i) => i,
    marker: markerAt,
    grid: wantGrid = false,
    lineWidth = 1.6,
  } = opts;

  const boxes = gridOf(items.length, { box, cols, gap, rowGap, label });

  // One domain for all of them, derived from every point in every item.
  const xDomain = (Array.isArray(x) ? x : x.domain)
    ?? d3.extent(items.flatMap((item, i) => points(item, i).map((p) => p[0])));
  const yDomain = (Array.isArray(y) ? y : y.domain)
    ?? [0, headroom(items.flatMap((item, i) => points(item, i).map((p) => p[1])),
                    (y.headroom ?? 1.15))];

  const built = items.map((item, i) => {
    const b = boxes[i];
    const g = parent.append("g");
    const ax = plot(g, b, { x: xDomain, y: yDomain });
    const chrome = wantGrid
      ? gridlines(g, ax, { xTicks: x.ticks ?? [], yTicks: y.ticks ?? 2,
                           fx: x.format ?? String, fy: y.format ?? compact })
      : null;
    const line = series(g, ax, points(item, i), { slot: slot(item, i), width: lineWidth });
    const point = markerAt ? markerAt(item, i) : null;

    return {
      item, g, ax, box: b,
      grid: chrome,
      line: line.path,
      d: line.d,
      marker: point ? marker(g, ax, point, { slot: slot(item, i), r: 4 }) : null,
      name: name ? body(g, name(item, i), 16, "ink2", { x: b.left, y: b.top - 10 }) : null,
      note: note ? body(g, note(item, i), 15, "muted", { x: b.left, y: b.bottom + 26 }) : null,
    };
  });

  /* One facet arriving: the name and its empty axes, the curve drawn across
     them, and then - once the curve has almost finished - the point it was
     drawn to show. Four moves, one gesture. */
  const arrive = (facet) => together(
    facet.name ? enter(facet.name, { from: "below", distance: 8, duration: 0.45 }) : null,
    enter([facet.ax, facet.grid].filter(Boolean), { duration: 0.45 }),
    draw(facet.line, { duration: 0.7 }),
    after(0.55,
      facet.marker ? pop(facet.marker, { duration: 0.35 }) : null,
      facet.note ? enter(facet.note, { duration: 0.35 }) : null),
  );

  return {
    boxes,
    facets: built,
    parts: built,
    arrive,

    /* n facets, n beats: each one lands and then waits. The scene with
       eight things to say and eight pictures to say them over. */
    beats: () => beatsOver(built, arrive),

    /* All of them as one gesture, for when the grid is context rather than
       the argument. */
    all: (overlap = 0.3) => cascade(built, overlap, arrive),
  };
}
