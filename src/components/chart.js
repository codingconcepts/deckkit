/* A chart, as one object.

   Written out of the marks, a chart is four calls that always appear
   together and always get entered together: a frame, its gridlines, a key
   beside it, and then the data. Four calls isn't the problem - the problem
   is that three of them need the same box, the same scales and the same
   formatters, and a scene that passes those around by hand is a scene where
   the grid and the axis can disagree about the domain.

   So the frame owns the scales, and everything you draw on it goes through
   it. `c.line(points)` can't be on the wrong axis, because there's only
   one axis it could be on. */

import * as d3 from "d3";
import { region, keyAnchor } from "../core/layout.js";
import { compact } from "../core/format.js";
import { plot, gridlines, headroom } from "../marks/plot.js";
import { series, marker, band, bandPaths } from "../marks/series.js";
import { rule } from "../marks/rule.js";
import { counter } from "../marks/gauge.js";
import { key } from "../marks/key.js";
import { enter } from "../anim/steps.js";

/* An axis spec, in any of the three shapes a caller has to hand.

     [0, 24]                        a domain, that's all
     { domain, ticks, format }      a domain and how to read it
     { data, headroom, ticks }      some numbers, scaled with room to breathe

   The third is the one that stops two charts in the same deck quietly
   disagreeing: both say `{ data: everything }` and both get the same top. */
function axisSpec(spec = {}, fallbackFormat) {
  const s = Array.isArray(spec) ? { domain: spec } : spec;
  const domain = s.domain ?? [0, headroom(s.data ?? [1], s.headroom ?? 1.15)];
  return { domain, ticks: s.ticks, format: s.format ?? fallbackFormat };
}

export function chart(parent, opts = {}) {
  const {
    key: entries, keyReverse = false, keyAt,
    grid: wantGrid = true, labels = true,
  } = opts;
  const box = opts.box ?? region({ key: Boolean(entries) });

  const xs = axisSpec(opts.x, String);
  const ys = axisSpec(opts.y, compact);

  const g = parent.append("g");
  const ax = plot(g, box, { x: xs.domain, y: ys.domain });
  const chrome = wantGrid
    ? gridlines(g, ax, {
        xTicks: xs.ticks ?? 5, yTicks: ys.ticks ?? 4,
        fx: xs.format, fy: ys.format, labels,
      })
    : null;
  const legend = entries
    ? key(g, entries, { ...keyAnchor(box), ...keyAt, reverse: keyReverse })
    : null;

  const api = {
    g, ax, box, frame: ax.g, grid: chrome, legend,
    x: ax.x, y: ax.y,
    format: { x: xs.format, y: ys.format },

    /* Stage pixels for a data point, for the rare mark that has to be
       placed by hand. */
    at: (x, y) => [ax.x(x), ax.y(y)],

    line: (points, o = {}) => series(g, ax, points, o),
    dot: (point, o = {}) => marker(g, ax, point, o),

    /* Several lines at once, in slot order.

       `points` is how to get [[x, y], ...] out of one item, so the caller's
       data shape stays the caller's business. Returned in the same order it
       was given, which is also the slot order - so a cascade over the
       result animates them in the order the key lists them. */
    lines: (items, points, o = {}) =>
      items.map((item, i) => series(g, ax, points(item, i), {
        ...o, slot: typeof o.slot === "function" ? o.slot(item, i) : (o.slot ?? i),
      })),

    stack: (o) => band(g, ax, o),
    stackPaths: (o) => bandPaths(ax, o),

    /* A level, with its label out past the right-hand edge of the frame
       where there's nothing to collide with. */
    rule: (value, o = {}) => rule(g, ax, value, { x: box.right + 12, ...o }),

    counter: (o = {}) => counter(g, { format: ys.format, ...o }),

    /* The frame arriving: axes, grid and key as one move, because they are
       one thing - the chart being there. Data is entered separately, by the
       scene, because that's the part with a running order. */
    enter: (o = {}) => enter([ax, chrome, legend].filter(Boolean), { duration: 0.8, ...o }),

    parts: [ax, chrome, legend].filter(Boolean),
  };
  return api;
}

/* A chart with no chrome: a line in a box, for an inset or a table cell.

   Deliberately not a chart() with everything switched off. A sparkline is
   read as a shape, not as values - no axis, no labels, no grid, and a dot
   on the end only if the end is the point. */
export function sparkline(parent, points, opts = {}) {
  const {
    x, y, width = 120, height = 34, slot = 0,
    fill = false, fillOpacity = 0.25, domain, last = false, lineWidth = 1.6,
    // Not primed for a draw-on by default: a sparkline is read as a shape
    // and fades in whole. Priming it and then fading it in leaves the line
    // at full stroke-dashoffset - present, invisible, and baffling.
    draw: drawOn = false,
  } = opts;
  const xd = d3.extent(points, (p) => p[0]);
  const yd = domain ?? [Math.min(0, d3.min(points, (p) => p[1])), d3.max(points, (p) => p[1])];
  const ax = {
    x: d3.scaleLinear(xd, [x, x + width]),
    y: d3.scaleLinear(yd, [y + height, y]),
  };
  const g = parent.append("g");

  const area = fill
    ? series(g, ax, [[xd[0], yd[0]], ...points, [xd[1], yd[0]]],
             { slot, fill: true, fillOpacity, width: 0, prime: false })
    : null;
  const line = series(g, ax, points, { slot, width: lineWidth, prime: drawOn });
  const end = last ? marker(g, ax, points[points.length - 1], { slot, r: 3 }) : null;

  return { g, ax, line: line.path, d: line.d, area, end, parts: [area, line.path, end] };
}
