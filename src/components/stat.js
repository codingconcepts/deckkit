/* One number, big, with the sentence that says what it is.

   The slide a deck ends on. Three texts and a centre, which is trivial
   until the straplines are two different sizes in two different scenes and
   the figure sits a few pixels off the optical centre in one of them. */

import { W, H, svgText, body } from "../core/stage.js";
import { together } from "../anim/combinators.js";
import { enter, pop } from "../anim/steps.js";

export function stat(parent, opts = {}) {
  const {
    value, lines: rows = [], cx = W / 2, cy = H / 2,
    size = 88, strapSize = 21, pitch = 26, status, slot, fill = "ink",
  } = opts;

  const figure = svgText(parent, String(value), {
    size, fill: status ? { status } : slot !== undefined ? { slot } : fill,
    x: cx, y: cy, anchor: "middle",
  });

  // Hung below the figure's baseline, so the block grows downwards and the
  // number stays where the layout put it however many lines follow it.
  const straps = rows.map((text, i) =>
    body(parent, text, strapSize, "ink2",
         { x: cx, y: cy + 44 + i * pitch, anchor: "middle" }));

  return {
    figure, straps, cx, cy,
    parts: [figure, ...straps],
    enter: (o = {}) => together(
      pop(figure, { scale: 0.85, duration: 0.9, ...o }),
      straps.length ? enter(straps, { from: "below", duration: 0.7 }) : null,
    ),
  };
}
