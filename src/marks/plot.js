/* The frame: a pair of scales, and the chrome that makes them readable.

   Everything is given its domains and its formatters, so the same two
   functions draw a day against throughput, a month against cost, or a
   percentile against latency. What they're not free about is weight:
   hairline, solid, recessive, under the data. That part is house style
   rather than a parameter. */

import * as d3 from "d3";
import { el, body } from "../core/stage.js";
import { THEME } from "../core/theme.js";
import { compact } from "../core/format.js";

/* A box with two axis rules and the scales to go with it.

   `box` is {left, right, top, bottom} in stage pixels - explicit, because
   SVG has no layout engine and a slide's vertical landmarks are better
   named than derived. The y range is inverted for you, so a scene never
   writes [bottom, top] and never gets it the wrong way round. */
export function plot(parent, box, domains = {}) {
  const { x: xDomain = [0, 1], y: yDomain = [0, 1] } = domains;
  const x = d3.scaleLinear(xDomain, [box.left, box.right]);
  const y = d3.scaleLinear(yDomain, [box.bottom, box.top]);
  const g = parent.append("g");
  el(g, "line", { x1: box.left, x2: box.right, y1: box.bottom, y2: box.bottom,
                  stroke: THEME.axis, "stroke-width": THEME.hairline });
  el(g, "line", { x1: box.left, x2: box.left, y1: box.bottom, y2: box.top,
                  stroke: THEME.axis, "stroke-width": THEME.hairline });
  return { x, y, g, box };
}

/* Gridlines and tick labels, as one group.

   Returned together so the whole grid can be faded in behind the data in a
   single step - it belongs underneath the marks, never on top of them.

   `yTicks` is a count because the y-axis is a magnitude and even divisions
   are what you want; `xTicks` is a list because the interesting x values
   are landmarks - midnight, the start of business, the close - and picking
   them evenly puts labels where nothing happens. Pass a number and you get
   even divisions anyway, for the axes where that's genuinely right. */
export function gridlines(parent, ax, opts = {}) {
  const {
    yTicks = 4, xTicks = [], labels = true, size = 15,
    fy = compact, fx = String,
  } = opts;
  const [x0, x1] = ax.x.domain();
  const yMax = ax.y.domain()[1];
  const g = parent.append("g");

  for (let i = 1; i <= yTicks; i++) {
    const v = (yMax * i) / yTicks;
    el(g, "line", { x1: ax.x(x0), x2: ax.x(x1), y1: ax.y(v), y2: ax.y(v),
                    stroke: THEME.grid, "stroke-width": THEME.hairline * 0.8 });
    if (labels) {
      body(g, fy(v), size, "muted", { x: ax.x(x0) - 10, y: ax.y(v) + size * 0.36, anchor: "end" });
    }
  }
  if (labels) {
    const ticks = typeof xTicks === "number" ? ax.x.ticks(xTicks) : xTicks;
    for (const t of ticks) {
      body(g, fx(t), size + 2, "muted", { x: ax.x(t), y: ax.y(0) + 26, anchor: "middle" });
    }
  }
  return g;
}

/* The top of a y-scale: the data's maximum, plus room to breathe.

   A curve that touches the frame reads as clipped, and a peak that's the
   whole point of the scene shouldn't be the pixel the chart runs out at.
   Said here once, because every chart in a deck wants it and each one
   otherwise spells out its own `d3.max(...) * 1.15`. */
export const headroom = (values, factor = 1.15) => d3.max(values.flat()) * factor;
