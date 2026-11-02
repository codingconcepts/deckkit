/* Levels, spans and pointers: the marks that are about a value rather than
   made of one. */

import { el, body, svgText } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { arrowHead } from "../core/geometry.js";
import { mark } from "../anim/scene.js";
import { draw, fadeTo } from "../anim/steps.js";

/* A threshold line, with its label.

   Dashed, because it's a level somebody chose rather than a level the data
   reached - a solid rule at the same place reads as another gridline.

   Drawn with zero length and the label hidden, for the extend() step to
   grow and the fade to bring in. A threshold that's simply present has
   already made its point before the speaker gets to it. */
export function rule(parent, ax, value, opts = {}) {
  const { slot, status, colour, ink, label, x: labelX, dy = 6, size = 19 } = opts;
  const stroke = paint({ slot, status, colour, ink }, THEME.ink2);
  const [x0] = ax.x.domain();
  const line = el(parent, "line", {
    x1: ax.x(x0), x2: ax.x(x0), y1: ax.y(value), y2: ax.y(value),
    stroke, "stroke-width": THEME.hairline + 0.4, "stroke-dasharray": "7 5",
  });
  const text = label === undefined ? null
    : body(parent, label, size, { colour: stroke }, { x: labelX, y: ax.y(value) + dy, opacity: 0 });
  // `end` is where extend() should grow the line to: the far edge of the
  // frame. Carried on the mark so a scene never re-derives it from the
  // domain and never gets it a pixel short of the axis.
  return { line, text, value, end: ax.x(ax.x.domain()[1]), parts: [line, text] };
}

/* A dashed rule in stage pixels, spanning something, with a figure over it.

   rule() is for a threshold that still means something in data space. This
   is for marking the top of a column on a stage the chart has already left
   - by the time it's drawn there's no axis to hang it on. Grown from its
   left end by extend(), so it comes back with the x to grow it to.

   Hairline + dashed, same as rule(): both are a level somebody chose, and
   they should look like the same kind of claim. */
export function span(parent, opts) {
  const {
    cx, width, y, label, status = "critical", colour, slot, ink: inkSpec,
    size = 26, overhang = 45, dy = -18,
  } = opts;
  const ink = paint({ slot, status, colour, ink: inkSpec }, THEME.critical);
  const x0 = cx - width / 2 - overhang;
  const line = el(parent, "line", {
    x1: x0, x2: x0, y1: y, y2: y,
    stroke: ink, "stroke-width": THEME.hairline + 0.4, "stroke-dasharray": "7 5",
  });
  const text = label === undefined ? null
    : svgText(parent, label, { size, fill: { colour: ink }, x: cx, y: y + dy, anchor: "middle" });
  return { line, text, end: cx + width / 2 + overhang, parts: [line, text] };
}

/* A label pointing at a place on the stage, with a leader to get there.

   The move a presenter makes with a laser pointer, which is the move a
   recorded deck has no way to make. The leader is a right-angled elbow
   rather than a diagonal: a diagonal across a chart crosses gridlines at
   angles that read as data.

   Primed for draw(), with the head and the text hidden behind it - so the
   whole annotation arrives as one gesture: line out, head lands, label
   appears. */
export function annotate(parent, point, opts = {}) {
  const {
    text: label, dx = 90, dy = -70, size = 19, status, slot, colour, ink: inkSpec,
    anchor = dx >= 0 ? "start" : "end", gap = 10, head = true,
  } = opts;
  const ink = paint({ slot, status, colour, ink: inkSpec }, THEME.ink2);
  const [px, py] = point;
  const corner = [px + dx, py + dy];
  const g = parent.append("g");

  /* The leader runs from the label's end, turns, and arrives at the mark -
     so the draw-on travels towards the thing being pointed at, and stops a
     few pixels short of it so the head has somewhere to sit.

     `side` is which way the approach comes from: the label is at px + dx,
     so a negative dx puts it to the left and the arrow travels rightwards.
     Getting this sign wrong draws an arrow that overshoots the mark and
     points back at the label, which is how the first version of this
     function behaved. */
  const side = Math.sign(dx) || 1;
  const d = `M${corner[0]},${corner[1]}V${py}H${px + side * 14}`;
  const line = el(g, "path", {
    d, fill: "none", stroke: ink, "stroke-width": THEME.hairline + 0.3,
  });
  const length = line.node().getTotalLength();
  line.attr("stroke-dasharray", length).attr("stroke-dashoffset", length);

  const tip = head
    ? el(g, "path", {
        d: arrowHead([px + side * 6, py], side < 0 ? 0 : Math.PI, 8),
        fill: ink, opacity: 0,
      })
    : null;
  const caption = label === undefined ? null
    : body(g, label, size, { colour: ink },
           { x: corner[0] + (anchor === "start" ? gap : -gap), y: corner[1] - 8, anchor, opacity: 0 });

  /* The whole annotation as one move.

     Everything here is drawn hidden, which is exactly the case where
     enter() animates nothing from nothing - so the component owns its own
     arrival rather than leaving each scene to remember that. */
  const arrive = (o = {}) => (tl, position) => {
    const duration = o.duration ?? 0.7;
    const at = mark(tl, position);
    draw(line, { duration, ease: "power1.inOut" })(tl, at);
    if (tip) fadeTo(tip, 1, { duration: 0.25 })(tl, `${at}+=${duration * 0.85}`);
    if (caption) fadeTo(caption, 1, { duration: 0.4 })(tl, `${at}+=${duration * 0.6}`);
  };

  return { g, line, tip, text: caption, corner, arrive, parts: [line, tip, caption] };
}
