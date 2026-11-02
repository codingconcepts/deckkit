/* A database cylinder, optionally wearing a mark.

   Assembled rather than imported: an ellipse for the lid, a rectangle for
   the body, and a second ellipse half-hidden behind the body so the base
   curves the same way the lid does. Body and base carry no stroke and the
   silhouette is two side rules instead, because a stroked rectangle draws a
   straight line across the belly where the base should be round. */

import { el } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { glyph } from "./glyph.js";

export const NODE = { width: 112, height: 155 };

export function cylinder(parent, opts) {
  const {
    cx, cy, width = NODE.width, height = NODE.height,
    glyph: mark, fill = "node", lid: lidPaint = "nodeLid",
  } = opts;
  const lid = width * 0.3;
  const bodyH = height - lid;
  const top = cy - height / 2 + lid / 2;   // top edge of the body rect
  const bottom = top + bodyH;
  const g = parent.append("g");
  const face = paint(fill, THEME.node);
  const rim = paint(lidPaint, THEME.nodeLid);

  // Painter's order: base first so the body hides its far half, mark last.
  el(g, "ellipse", { cx, cy: bottom, rx: width / 2, ry: lid / 2, fill: face });
  el(g, "rect", { x: cx - width / 2, y: top, width, height: bodyH, fill: face });
  for (const side of [-1, 1]) {
    el(g, "line", {
      x1: cx + (side * width) / 2, x2: cx + (side * width) / 2, y1: top, y2: bottom,
      stroke: rim, "stroke-width": THEME.hairline,
    });
  }
  el(g, "ellipse", { cx, cy: top, rx: width / 2, ry: lid / 2, fill: rim });

  // Centred on the dark face, not on the rectangle: the lid covers the
  // rect's top half-ellipse and the base adds one below it, so the face you
  // actually see sits half a lid lower - and a mark centred on the body
  // reads as riding high on the cylinder.
  const emblem = glyph(g, mark, { cx, cy: (top + bottom) / 2 + lid / 2, height: height * 0.4 });

  return { g, cx, cy, top, bottom, width, height, emblem };
}

/* A plain box, for the things in a diagram that aren't databases.

   Same contract as cylinder() - a centre, a size and a glyph - so flow()
   and cluster() can take either without caring which. */
export function box(parent, opts) {
  const {
    cx, cy, width = NODE.width, height = NODE.height * 0.7,
    glyph: mark, fill = "node", stroke = "nodeLid", radius = 8, label,
  } = opts;
  const g = parent.append("g");
  const top = cy - height / 2;
  el(g, "rect", {
    x: cx - width / 2, y: top, width, height, rx: radius,
    fill: paint(fill, THEME.node), stroke: paint(stroke, THEME.nodeLid),
    "stroke-width": THEME.hairline,
  });
  const emblem = glyph(g, mark, { cx, cy: label ? cy - height * 0.12 : cy, height: height * 0.45 });
  return { g, cx, cy, top, bottom: top + height, width, height, emblem };
}
