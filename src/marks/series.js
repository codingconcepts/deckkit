/* The marks a chart is made of.

   Each returns the selections it made, because the pacing layer animates
   what it's handed - a series comes back primed for a draw-on, a rule
   comes back with its label already hidden and waiting. Drawing and
   choreography stay separate, but drawing knows what choreography is going
   to ask for. */

import * as d3 from "d3";
import { el } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { primeDrawOn } from "../core/geometry.js";

/* One line, primed to be drawn on.

   `points` is [[x, y], ...] in data space. Parallel arrays are the usual
   shape upstream, so the chart layer zips them - that keeps this function
   free of any opinion about where x comes from.

   No smoothing by default. A curve drawn through measured samples with a
   spline through it's a claim about values nobody recorded; where a spike
   is real, it should look like one. */
export function series(parent, ax, points, opts = {}) {
  const {
    slot, status, colour, ink, width = THEME.lineWidth, fill = "none",
    fillOpacity, curve = d3.curveLinear, prime = true,
  } = opts;
  const stroke = paint({ slot, status, colour, ink }, THEME.ink);
  const d = d3.line().x((p) => ax.x(p[0])).y((p) => ax.y(p[1])).curve(curve)(points);

  const attrs = { d, fill: fill === true ? stroke : fill, stroke, "stroke-width": width };
  if (fillOpacity !== undefined) attrs["fill-opacity"] = fillOpacity;
  const path = el(parent, "path", attrs);
  if (prime) primeDrawOn(path);
  return { path, d, g: path };
}

/* A single point, called out.

   The halo is the surface colour rather than none: on a chart where several
   series overlap, an unhaloed dot reads as a kink in whichever line happens
   to pass behind it.

   Kept separate from series() rather than folded in as an option, because
   where several series share a frame every line must be under every marker
   - which means drawing all the lines first and all the markers after, not
   interleaving them per series. */
export function marker(parent, ax, point, opts = {}) {
  const { slot, status, colour, ink, r = 4.5 } = opts;
  return el(parent, "circle", {
    cx: ax.x(point[0]), cy: ax.y(point[1]), r,
    fill: paint({ slot, status, colour, ink }, THEME.ink),
    stroke: THEME.surface, "stroke-width": THEME.gapWidth,
  });
}

/* A stacked area, as one band per key.

   `rows` is the wide shape d3.stack wants - one row per sample, with an `x`
   and a column per key. The gap between bands is a surface-coloured stroke
   rather than a space, so the bands stay adjacent and the separation is
   drawn rather than left. */
export function band(parent, ax, opts) {
  const { rows, keys, slots, opacity = 0.9 } = opts;
  const stacked = d3.stack().keys(keys)(rows);
  const g = parent.append("g");
  const paths = g
    .selectAll("path")
    .data(stacked)
    .join("path")
    .attr("d", stackArea(ax))
    .attr("fill", (_, i) => paint({ slot: slots ? slots[i] : i }))
    .attr("fill-opacity", opacity)
    .attr("stroke", THEME.surface)
    .attr("stroke-width", THEME.gapWidth);
  return { g, paths, stacked };
}

/* The d-strings a band *would* have, for a different set of values.

   Two stacks built from the same key list have identical path structure, so
   each band can be morphed from one to the other instead of cross-faded -
   which is what lets a stack visibly rearrange rather than blink. */
export const bandPaths = (ax, { rows, keys }) =>
  d3.stack().keys(keys)(rows).map((layer) => stackArea(ax)(layer));

const stackArea = (ax) =>
  d3.area().x((d) => ax.x(d.data.x)).y0((d) => ax.y(d[0])).y1((d) => ax.y(d[1]))
    .curve(d3.curveLinear);
