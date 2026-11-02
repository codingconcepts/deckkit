/* The stage, and the SVG primitives everything else is assembled from.

   Manim gives you a scene graph for free: next_to, align_to, arrange, VGroup.
   SVG gives you none of that, so layout is explicit pixel arithmetic against
   a fixed stage. That's the main cost of working this way, and the reason
   layout.js names the landmarks instead of letting scenes scatter magic
   numbers through a build. */

import { THEME, paint } from "./theme.js";

/* 16:9 at a size where one unit is about one pixel on a projector. Fixed
   rather than responsive: the deck shell scales the whole viewBox, so a
   scene composed at 1280x720 is composed once and fits everywhere. */
export const W = 1280;
export const H = 720;

// ---------------------------------------------------------------- elements

export const el = (parent, name, attrs = {}) => {
  const node = parent.append(name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) node.attr(k, v);
  return node;
};

export const group = (parent, attrs = {}) => el(parent, "g", attrs);

/* Type.

   `fill` is a paint spec rather than a colour - `"ink2"`, `{ slot: 3 }`,
   `{ status: "critical" }` - so no call site ever holds a hex value. */
export function svgText(parent, str, opts = {}) {
  const {
    size = 22, fill, x = 0, y = 0,
    anchor = "start", baseline = "auto", opacity = 1, weight,
  } = opts;
  const node = parent
    .append("text")
    .text(str)
    .attr("x", x).attr("y", y)
    .attr("font-family", THEME.font)
    .attr("font-size", size)
    .attr("fill", paint(fill, THEME.ink2))
    .attr("text-anchor", anchor)
    .attr("dominant-baseline", baseline)
    .attr("opacity", opacity);
  if (weight) node.attr("font-weight", weight);
  return node;
}

export const body = (parent, str, size = 22, fill = "ink2", opts = {}) =>
  svgText(parent, str, { size, fill, ...opts });

export const headline = (parent, str, opts = {}) =>
  svgText(parent, str, { size: 34, fill: "ink", ...opts });

/* A headline built out of per-character tspans, for the Write effect.

   `segments` is [{text, fill}] so a phrase can carry its own paint - the
   web equivalent of Manim's t2c. A plain string is accepted too, because
   most lines are one colour and `[{text: s}]` is ceremony. Characters
   animate fill-opacity only: SVG 1.1 doesn't honour a transform on a
   tspan, so there's no shift to stagger alongside it. */
export function typeset(parent, segments, opts = {}) {
  const { size = 48, x = W / 2, y = 0, anchor = "middle", fill = "ink" } = opts;
  const rows = typeof segments === "string" ? [{ text: segments }] : segments;
  const text = parent
    .append("text")
    .attr("x", x).attr("y", y)
    .attr("font-family", THEME.font)
    .attr("font-size", size)
    .attr("text-anchor", anchor);

  const spans = [];
  for (const segment of rows) {
    for (const ch of segment.text) {
      spans.push(
        text.append("tspan")
          .text(ch)
          // A plain space collapses in SVG; the non-breaking space holds.
          .attr("xml:space", "preserve")
          .attr("fill", paint(segment.fill ?? fill, THEME.ink))
          .attr("fill-opacity", 0)
          .node(),
      );
    }
  }
  return { text, spans, g: text };
}

/* Several typeset lines, stacked about a centre.

   A title card's job is to say two sentences in the middle of the stage,
   and the arithmetic for that's always the same: a pitch off the type
   size, half the block above the centre and half below. Spelling it out per
   scene is how the second line of a two-line card ends up eleven pixels
   from where the first one thinks it is.

   `centre` is where the block sits optically rather than where the first
   baseline lands - the cap-height nudge is applied here, once. */
export function lines(parent, rows, opts = {}) {
  const { size = 48, centre = H / 2, pitch = size * 1.3, x = W / 2, anchor = "middle", fill } = opts;
  const first = centre - ((rows.length - 1) * pitch) / 2 + size * 0.35;
  const out = rows.map((segments, i) =>
    typeset(parent, segments, { size, x, anchor, fill, y: first + i * pitch }));
  // Flattened too, because "write the whole card on" is the common case and
  // `out.flatMap(l => l.spans)` at every call site is noise.
  out.spans = out.flatMap((l) => l.spans);
  return out;
}

/* Rough text metrics, for the boxes that have to be wide enough.

   SVG will measure properly once a node is in the document, but layout here
   happens at build time against nodes that may not be laid out yet - and
   getBBox() on a hidden slide returns zeros. 0.54em per character is close
   enough for Helvetica at the sizes a deck uses, and everything that
   depends on it also takes an explicit width for when it isn't. */
export const textWidth = (str, size) => str.length * size * 0.54;
