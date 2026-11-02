/* Boxes and the arrows between them.

   Every architecture slide is this, and every architecture slide draws it
   by hand: a row of rectangles at coordinates somebody typed, and arrows
   whose endpoints are those coordinates plus or minus half a box width.
   Move one box and all of it's wrong.

   Here the boxes are laid out and the arrows are derived - a link says
   "from 2 to 5", and where that line starts and stops is the component's
   problem. Arrows leave the edge of a box, not its centre, and they turn at
   right angles rather than cutting diagonally, because a diagonal between
   two boxes reads as "related to" where a right angle reads as "flows
   into". */

import * as d3 from "d3";
import { el, body } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { region, fitRow, centreOf } from "../core/layout.js";
import { elbow, arrowHead } from "../core/geometry.js";
import { box as boxShape } from "../brand/cylinder.js";
import { mark } from "../anim/scene.js";
import { cascade, each } from "../anim/combinators.js";
import { enter, draw, fadeTo } from "../anim/steps.js";

export function flow(parent, opts = {}) {
  const {
    nodes: specs = [], links = [],
    box = region(), cy, width = 150, height = 96, gap = 110,
    shape = boxShape, labelBelow = true,
  } = opts;

  const centreY = cy ?? centreOf(box).cy;
  const slots = fitRow(specs.length, { box, cy: centreY, max: width, ratio: gap / width });
  const w = slots[0].right - slots[0].left;

  const built = specs.map((spec, i) => {
    const s = typeof spec === "string" ? { label: spec } : spec;
    const drawn = (s.shape ?? shape)(parent, {
      cx: slots[i].cx, cy: centreY, width: w, height, glyph: s.glyph, fill: s.fill,
    });
    const caption = s.label && labelBelow
      ? body(parent, s.label, 19, "ink2",
             { x: slots[i].cx, y: drawn.bottom + 28, anchor: "middle" })
      : null;
    const sub = s.sub
      ? body(parent, s.sub, 16, "muted",
             { x: slots[i].cx, y: drawn.bottom + 50, anchor: "middle" })
      : null;
    return { ...drawn, spec: s, label: caption, sub, parts: [drawn.g, caption, sub] };
  });

  /* A link, primed to be drawn on.

     The head is a separate path at zero opacity rather than a marker: a
     marker arrives the instant the line exists, which gives away where the
     arrow is going before it gets there. */
  const drawn = links.map((link) => {
    const [from, to, o = {}] = link;
    const a = built[from];
    const b = built[to];
    const forward = b.cx > a.cx;
    const start = [forward ? a.cx + a.width / 2 : a.cx - a.width / 2, a.cy];
    const stop = [forward ? b.cx - b.width / 2 - 11 : b.cx + b.width / 2 + 11, b.cy];
    const ink = paint(o, THEME.ink2);

    const path = el(parent, "path", {
      d: elbow(start, stop, { bend: "h" }),
      fill: "none", stroke: ink, "stroke-width": THEME.hairline + 0.5,
      "stroke-dasharray": o.dashed ? "6 5" : undefined,
    });
    // Dashed links can't be drawn on with stroke-dashoffset - the dash is
    // the mark - so they fade instead, and say so.
    const length = path.node().getTotalLength();
    if (!o.dashed) path.attr("stroke-dasharray", length).attr("stroke-dashoffset", length);
    else path.attr("opacity", 0);

    const head = el(parent, "path", {
      d: arrowHead(stop, forward ? 0 : Math.PI, 9), fill: ink, opacity: 0,
    });
    const caption = o.label
      ? body(parent, o.label, 16, { colour: ink },
             { x: (start[0] + stop[0]) / 2, y: a.cy - 14, anchor: "middle", opacity: 0 })
      : null;

    return { path, head, label: caption, dashed: Boolean(o.dashed),
             parts: [path, head, caption] };
  });

  /* A link arriving: the line travels, the head lands when it gets there,
     the label catches up just behind. */
  const connect = (i, o = {}) => (tl, position) => {
    const link = drawn[i];
    const duration = o.duration ?? 0.7;
    const label = mark(tl, position);
    if (link.dashed) fadeTo(link.path, 1, { duration })(tl, label);
    else draw(link.path, { duration, ease: "power1.inOut" })(tl, label);
    fadeTo(link.head, 1, { duration: 0.25 })(tl, `${label}+=${duration * 0.8}`);
    if (link.label) fadeTo(link.label, 1, { duration: 0.4 })(tl, `${label}+=${duration * 0.5}`);
  };

  return {
    nodes: built,
    links: drawn,
    parts: [...built, ...drawn],

    /* One box arriving, with whatever is written under it. */
    place: (i, o = {}) => enter(built[i], { from: "below", distance: 14, duration: 0.5, ...o }),

    connect,

    /* The whole diagram assembling: every box, then every arrow. Boxes
       cascade, because n of them appearing is one gesture; arrows follow in
       order, because an arrow is a claim about what happens first. */
    all: (o = {}) => (tl, position) => {
      const label = mark(tl, position);
      cascade(d3.range(built.length), 0.25, (i) =>
        enter(built[i], { from: "below", distance: 14, duration: 0.5 }))(tl, label);
      each(d3.range(drawn.length), (i) => connect(i, o))(
        tl, `${label}+=${0.5 + built.length * 0.25}`);
    },
  };
}
