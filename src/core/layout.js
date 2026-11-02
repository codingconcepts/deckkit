/* Where things go.

   This is the most opinionated file in the library, and deliberately so.
   Every deck written without it ends up with a title at y=58 in one scene
   and y=62 in the next, a caption at 604 here and 672 there, and nobody
   notices until the slides are cut together and the headline jumps four
   pixels between them. A stage with no layout engine needs named landmarks
   or it gets magic numbers, and magic numbers drift.

   So: the vertical landmarks are constants, the drawing region is derived
   from them, and the components place themselves. A scene that wants a
   title doesn't get to choose where the title goes. */

import * as d3 from "d3";
import { W, H } from "./stage.js";
import { dodge } from "./geometry.js";

/* Side margins, and the gutter a key needs on the right.

   86 is a hair under 7% of the stage. Wide enough that a y-axis label has
   somewhere to sit, narrow enough that a chart still feels like the slide
   rather than an inset in it. */
export const MARGIN = { left: 86, right: 86, gutter: 294 };

/* The horizontal baselines of a slide, top to bottom.

   `title` and `strap` are baselines, not box tops - type is positioned by
   its baseline everywhere in SVG, and converting at each call site is how
   two lines of the same size end up optically different distances from the
   top edge. */
export const SLOT = {
  title: 62,
  strap: 100,
  top: 150,      // the top of the drawing region
  bottom: 600,   // its floor: everything below this is captioning
  caption: 668,
  footnote: 702,
};

/* The region a slide's content gets.

   `key: true` reserves the right-hand gutter, so a chart with a legend and
   a chart without one still start at the same left edge and still finish
   their frame at a sensible place. `strap: false` reclaims the strapline's
   band when a slide hasn't got one, which is 40px of chart on a 720 stage
   and visible. */
export const region = ({ key = false, strap = true, top, bottom } = {}) => ({
  left: MARGIN.left,
  right: W - MARGIN.right - (key ? MARGIN.gutter : 0),
  top: top ?? (strap ? SLOT.top : SLOT.top - 40),
  bottom: bottom ?? SLOT.bottom,
});

/* Where a key goes, given the region it sits beside. */
export const keyAnchor = (box) => ({ x: box.right + 40, y: box.top + 20 });

export const centreOf = (box) => ({ cx: (box.left + box.right) / 2, cy: (box.top + box.bottom) / 2 });

/* Equal boxes tiled over a region, for small multiples.

   Returned in reading order - across, then down - so the i-th box belongs
   to the i-th series and the grid needs no index arithmetic at the call
   site. Each box carries its own centre as well as its edges, because half
   of what gets hung on a box is hung off the middle of it.

   `centre: true` centres the whole grid on the stage, and is computed off
   the column count rather than the item count, so a short last row doesn't
   drag the grid sideways. */
export function tile(count, opts) {
  const { left = 0, top, width, height, cols, gap = 0, pitch = height, centre = false } = opts;
  const span = cols * width + (cols - 1) * gap;
  const x0 = centre ? (W - span) / 2 : left;
  return d3.range(count).map((i) => {
    const l = x0 + (i % cols) * (width + gap);
    const t = top + Math.floor(i / cols) * pitch;
    return {
      left: l, right: l + width, top: t, bottom: t + height,
      cx: l + width / 2, cy: t + height / 2,
    };
  });
}

/* A grid of equal boxes that fills a region, given how many items there are.

   tile() with the arithmetic done for you. Pass the count and the region
   and you get boxes back; pass `cols` to override the shape it picks. The
   default column count is the one that keeps the boxes closest to 16:9,
   which is the aspect a chart wants and the aspect the eye expects after
   looking at the full-size one on the previous slide. */
export function grid(count, opts = {}) {
  const {
    box = region(), gap = 42, rowGap = gap * 2.1,
    cols = bestCols(count, box), label = 0,
  } = opts;
  const rows = Math.ceil(count / cols);
  const width = (box.right - box.left - (cols - 1) * gap) / cols;
  const pitch = (box.bottom - box.top + rowGap) / rows;
  const height = pitch - rowGap - label;
  return tile(count, { left: box.left, top: box.top + label, width, height, cols, gap, pitch });
}

/* The column count that gets the tiles nearest to 16:9. */
function bestCols(count, box) {
  const want = 16 / 9;
  let best = 1;
  let error = Infinity;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const aspect = ((box.right - box.left) / cols) / ((box.bottom - box.top) / rows);
    const e = Math.abs(Math.log(aspect / want));
    if (e < error) { error = e; best = cols; }
  }
  return best;
}

/* One centred row of equal slots, about a shared centreline.

   tile() with the row already decided. A row of nodes, columns or chips is
   common enough - and the `cols: count, height: 0` spelling obscure enough
   - to be worth its own name. */
export const row = (count, opts) => {
  const { width, gap = 0, cy = H / 2, height = 0 } = opts;
  return tile(count, { cols: count, width, height, gap, top: cy - height / 2, centre: true });
};

/* A row that fits: n slots inside a region, with the gap as a fraction of
   the slot. For when the count is data and the width therefore can't be.

   Centred on the region rather than on the stage, which is the difference
   between this and row(). They agree whenever the region is symmetric, and
   a region with `key: true` is the case where they don't - reserving the
   gutter is pointless if the row then lays itself out across it. */
export const fitRow = (count, { box = region(), cy, ratio = 0.55, max = Infinity } = {}) => {
  const span = box.right - box.left;
  const width = Math.min(max, span / (count + (count - 1) * ratio));
  const gap = width * ratio;
  const used = count * width + (count - 1) * gap;
  return tile(count, {
    left: box.left + (span - used) / 2,
    top: cy ?? centreOf(box).cy,
    width, height: 0, cols: count, gap,
  });
};

/* Values laid out as one stacked column, proportional and bottom-up.

   Pure pixels in, pure pixels out: no scale, no data, just "these n numbers
   fill this box in proportion". Returns {x0, y0, x1, y1} per value, which
   is what blockPath() takes. The running cursor is the part worth hiding -
   it's a loop with mutable state in the middle of a scene otherwise. */
export function stackColumn(values, opts) {
  const { cx, width, top, baseline } = opts;
  const total = d3.sum(values) || 1;
  const span = baseline - top;
  let cursor = baseline;
  return values.map((v) => {
    const height = (v * span) / total;
    const slice = { x0: cx - width / 2, x1: cx + width / 2, y0: cursor - height, y1: cursor };
    cursor -= height;
    return slice;
  });
}

/* Columns standing at their own positions, nudged apart where they collide.

   `xs` and `tops` are already in stage pixels - the caller has put them
   through its own scales, because which axis they came off isn't this
   function's business. Overlapping columns are spread by dodge(), so a
   scene that claims eight of something shows eight. */
export function columnsAt(xs, tops, opts) {
  const { width, baseline, gap = width * 1.2 } = opts;
  return dodge(xs, gap).map((x, i) => ({
    x0: x - width / 2, x1: x + width / 2, y0: tops[i], y1: baseline,
  }));
}
