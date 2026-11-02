/* Columns: the chart you use when there's no axis left, only two numbers. */

import { el, body, svgText } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { compact } from "../core/format.js";

/* One bar, with its figure and its caption below it.

   Everything hangs under the bar rather than above it, so nothing collides
   with whatever gets stacked on top of a short column. `figure` arrives
   formatted: how a magnitude should be written is a property of the deck,
   not of the bar. */
export function column(parent, opts) {
  const { value, scale, figure, label, baseline, cx, width = 135, slot, status, colour, ink } = opts;
  const g = parent.append("g");
  const height = Math.max(value * scale, 0.01);
  const bar = el(g, "rect", {
    x: cx - width / 2, y: baseline - height, width, height,
    fill: paint({ slot, status, colour, ink }), "fill-opacity": 0.9,
  });
  const caption = svgText(g, figure, { size: 32, fill: "ink", x: cx, y: baseline + 36, anchor: "middle" });
  const under = body(g, label, 19, "ink2", { x: cx, y: baseline + 60, anchor: "middle" });
  return { g, bar, figure: caption, caption: under, height, parts: [bar, caption, under] };
}

/* Two columns and the money between them.

   The taller value sets the scale, so a caller gives two magnitudes and one
   pixel height for the taller of them - never a scale factor, which is the
   number that then has to be multiplied back through four more expressions
   to place anything.

   The delta is drawn stacked on top of the shorter column rather than
   beside it, up to the height the taller one reaches: the difference
   between two numbers is legible where one of them stops. */
export function comparison(parent, opts) {
  const {
    high, low, highLabel, lowLabel, highCx, lowCx,
    tallest, baseline, width = 135, format = compact,
    highPaint = { status: "critical" }, lowPaint = { slot: 0 },
    gapLabel, gapPaint = { status: "critical" },
  } = opts;
  const scale = tallest / high;
  const bar = (value, colour, label, cx) =>
    column(parent, { value, scale, colour: paint(colour), figure: format(value), label, baseline, cx, width });

  const tall = bar(high, highPaint, highLabel, highCx);
  const short = bar(low, lowPaint, lowLabel, lowCx);

  const ink = paint(gapPaint, THEME.critical);
  const top = baseline - tallest;
  const height = (high - low) * scale;
  const gap = el(parent, "rect", {
    x: lowCx - width / 2, y: top, width, height,
    fill: ink, "fill-opacity": 0.14, stroke: ink, "stroke-width": THEME.hairline,
  });
  const label = gapLabel === undefined ? null
    : body(parent, gapLabel, 19, { colour: ink },
           { x: lowCx + width / 2 + 14, y: top + height / 2 + 6 });

  return { tall, short, gap, label, scale, top, parts: [tall, short, gap, label] };
}
