/* A slide: the furniture, and a factory for everything that goes on it.

   This is where the library stops being a toolkit and starts being
   opinionated. A scene doesn't choose where its title goes, or how far
   above the caption the chart stops, or how wide the gutter is when there
   is a key. It says "this slide has a title and a chart with a key", and
   the arithmetic that used to live at the top of every build method - the
   vertical landmarks, the box, the legend anchor - is gone.

   Everything a slide hands back is already placed. `s.chart()` knows its
   box because the slide knows whether there's a strapline above it and a
   key beside it. `s.captions()` knows its y. `s.cluster()` centres itself
   in whatever is left. A scene that wants something somewhere else passes
   an explicit box and is on its own, which is the right trade: the easy
   path is the consistent one.

   The resulting build method reads as content, not coordinates. */

import { W, H, headline, body, lines as linesOf } from "../core/stage.js";
import { SLOT, region } from "../core/layout.js";
import { together } from "../anim/combinators.js";
import { enter, write } from "../anim/steps.js";
import { captions } from "./captions.js";
import { chart, sparkline } from "./chart.js";
import { facets } from "./facets.js";
import { cluster } from "./cluster.js";
import { stat } from "./stat.js";
import { bullets } from "./bullets.js";
import { flow } from "./flow.js";
import { comparison } from "../marks/bars.js";
import { annotate } from "../marks/rule.js";

export function slide(svg, opts = {}) {
  const { title, strap, key = false, box: override, footnote } = opts;

  const titleNode = title
    ? headline(svg, title, { x: W / 2, y: SLOT.title, anchor: "middle" })
    : null;
  const strapNode = strap
    ? body(svg, strap, 22, "ink2", { x: W / 2, y: SLOT.strap, anchor: "middle" })
    : null;
  const footNode = footnote
    ? body(svg, footnote, 16, "muted", { x: W / 2, y: SLOT.footnote, anchor: "middle", opacity: 0 })
    : null;

  // The region left over, once the furniture has had its bands.
  const box = override ?? region({ key, strap: Boolean(strap) });

  /* A convenience that's used everywhere: merge the slide's box into an
     options bag unless the caller overrode it. */
  const placed = (o = {}) => ({ box, ...o });

  return {
    svg, box,
    title: titleNode,
    strap: strapNode,
    footnote: footNode,

    /* The slide arriving. Title from above, strapline just behind it -
       the one opening move every scene makes, and the one most likely to
       be written four slightly different ways across seven scenes. */
    open: (o = {}) => together(
      titleNode ? enter(titleNode, { from: "above", duration: 0.9, ...o }) : null,
      strapNode ? enter(strapNode, { from: "below", distance: 8, duration: "700ms", at: "-400ms" }) : null,
    ),

    // ---- content, all of it pre-placed ---------------------------------

    /* A chart that knows whether it needs the right-hand gutter.

       Declaring `key: true` on the slide and then passing entries to the
       chart would be two places to say one thing, so passing entries is
       enough: the box is recomputed with the gutter reserved. */
    chart: (o = {}) => chart(svg, {
      ...o,
      box: o.box ?? override
        ?? region({ key: Boolean(o.key) || key, strap: Boolean(strap) }),
    }),
    facets: (items, o = {}) => facets(svg, items, placed(o)),
    cluster: (o = {}) => cluster(svg, placed(o)),
    flow: (o = {}) => flow(svg, placed(o)),
    bullets: (items, o = {}) => bullets(svg, items, placed(o)),
    captions: (items, o = {}) => captions(svg, items, o),
    sparkline: (points, o = {}) => sparkline(svg, points, o),
    annotate: (point, o = {}) => annotate(svg, point, o),

    /* A hero figure, centred in the region by default - or in the right-
       hand third of it, which is where a number goes when it's the verdict
       on a chart that's still on screen. */
    stat: (o = {}) => stat(svg, {
      cx: (box.left + box.right) / 2, cy: (box.top + box.bottom) / 2 + 20, ...o,
    }),

    /* Two columns and the money between them, standing on the region's
       floor. The caller gives two magnitudes; the pixel arithmetic is the
       component's. */
    comparison: (o = {}) => comparison(svg, {
      baseline: box.bottom - 40,
      tallest: (box.bottom - 40) - box.top - 30,
      highCx: box.left + 160,
      lowCx: box.left + 400,
      ...o,
    }),

    /* The footnote: the caveat you want on screen but not read out. */
    note: (o = {}) => (footNode ? enter(footNode, { duration: 0.6, ...o }) : null),
  };
}

/* A title card: two or three lines in the middle of an empty stage.

   Not a slide() - there's no region, no furniture and no caption slot,
   because a card that has any of those isn't a card. The only thing it
   does that a bare lines() call doesn't is type itself on in reading
   order. */
export function card(svg, rows, opts = {}) {
  const built = linesOf(svg, rows, { size: 54, centre: H / 2, ...opts });
  return {
    lines: built,
    spans: built.spans,
    parts: built.map((l) => l.text),

    /* One line at a time, so a two-line card is two beats: the claim, then
       the correction. */
    line: (i, o = {}) => write(built[i].spans, o),
    all: (o = {}) => write(built.spans, o),
  };
}
