/* The mark on the thing.

   A node in a cluster diagram is a cylinder with a logo on it, and the logo
   is the one part of a deck that's never the library's to decide. So:
   glyphs are data, in four shapes, and anything that draws furniture takes
   one.

     { path, viewBox }   an inlined SVG path. Takes a fill, so it inherits
                         the theme - this is the one that looks right.
     { href }            an external image. Can't be tinted; use it when
                         the mark is a photograph or a multi-colour logo
                         you're not allowed to recolour.
     { text }            one or two letters. The honest fallback, and better
                         than a wrong logo.
     null                nothing. A plain cylinder is a perfectly good node.

   A bare string is accepted and sniffed: it's a path if it starts with a
   moveto, an href otherwise. That's for the call site that has a path
   constant to hand and doesn't want to wrap it in an object. */

import { el, svgText } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";

const isPathData = (s) => /^[Mm][\s\d.,-]/.test(s.trim());

export function normaliseGlyph(spec) {
  if (!spec) return null;
  if (typeof spec === "string") return isPathData(spec) ? { path: spec } : { href: spec };
  return spec;
}

/* Draw a glyph centred on (cx, cy), scaled to fit a box `height` tall.

   `viewBox` is the coordinate system the path was authored in, so a path
   lifted straight out of a logo file needs no editing - give it the width
   and height from the file's own viewBox and it lands in the right place.
   `transform` is for the group transform some exporters wrap a path in;
   paste it verbatim rather than baking it into the path data. */
export function glyph(parent, spec, opts = {}) {
  const shape = normaliseGlyph(spec);
  if (!shape) return null;
  const { cx, cy, height, fill = "ink", opacity = 1 } = opts;

  if (shape.text) {
    return svgText(parent, shape.text, {
      size: shape.size ?? height * 0.8, fill, opacity,
      x: cx, y: cy + height * 0.3, anchor: "middle", weight: 600,
    });
  }

  if (shape.href) {
    const width = height * (shape.aspect ?? 1);
    return el(parent, "image", {
      href: shape.href, x: cx - width / 2, y: cy - height / 2,
      width, height, opacity, preserveAspectRatio: "xMidYMid meet",
    });
  }

  const [vw, vh] = shape.viewBox ?? [1000, 1000];
  const width = (height * vw) / vh;
  const g = parent
    .append("g")
    .attr("transform",
      `translate(${cx - width / 2},${cy - height / 2}) scale(${width / vw},${height / vh})`)
    .attr("opacity", opacity);
  const inner = shape.transform ? g.append("g").attr("transform", shape.transform) : g;
  el(inner, "path", { d: shape.path, fill: paint(fill, THEME.ink) });
  return g;
}

/* A small registry, so a deck says `glyph: GLYPHS.cockroach` rather than
   carrying 2kB of path data in a scene file. Add to it from a deck's own
   brand module - it's a plain object on purpose. */
export const GLYPHS = {
  /* The Cockroach Labs mark. Included because these decks are mostly about
     CockroachDB; it's Cockroach Labs' trademark, not this library's, and a
     deck for anything else should replace it rather than recolour it.

     Inlined rather than referenced: an <image href> wouldn't take a fill,
     and fetching the file to inline it at runtime fails under file://. The
     transform is the source file's own group transform, kept so the path
     lands in its nominal 1200x1240 viewBox. */
  cockroach: {
    viewBox: [1200, 1240],
    transform: "matrix(1.065066,0,0,1.065066,-446.809737,-444.951774)",
    path: "M457.07,981.415L457.07,981.115C436.342,981.115 419.514,964.286 419.514,943.558L419.514,605.551C419.514,584.823 436.342,567.995 457.07,567.995L532.183,567.995C552.911,567.995 569.739,551.166 569.739,530.438L569.739,455.326C569.739,434.598 586.568,417.769 607.296,417.769L870.19,417.769C890.918,417.769 907.746,434.598 907.746,455.326L907.746,492.882C907.746,534.338 941.403,567.995 982.859,567.995C1024.315,567.995 1057.972,534.338 1057.972,492.882L1057.972,455.326C1057.972,434.598 1074.8,417.769 1095.528,417.769L1358.423,417.769C1379.151,417.769 1395.979,434.598 1395.979,455.326L1395.979,530.438C1395.979,551.166 1412.808,567.995 1433.536,567.995L1508.648,567.995C1529.376,567.995 1546.205,584.823 1546.205,605.551L1546.205,943.558C1546.205,964.286 1529.376,981.115 1508.648,981.115L1433.536,981.115C1412.808,981.115 1395.979,964.286 1395.979,943.558L1395.979,605.551C1395.979,584.823 1379.151,567.995 1358.423,567.995L1133.085,567.995C1091.629,567.995 1057.972,601.652 1057.972,643.107C1057.972,684.563 1091.629,718.22 1133.085,718.22L1170.641,718.22C1191.369,718.22 1208.197,735.049 1208.197,755.777L1208.197,1394.235C1208.197,1414.963 1191.369,1431.791 1170.641,1431.791L1095.528,1431.791C1074.8,1431.791 1057.972,1448.62 1057.972,1469.347L1057.972,1544.46C1057.972,1565.188 1041.143,1582.017 1020.416,1582.017L945.303,1582.017C924.575,1582.017 907.746,1565.188 907.746,1544.46L907.746,1469.347C907.746,1448.62 890.918,1431.791 870.19,1431.791L795.077,1431.791C774.349,1431.791 757.521,1414.963 757.521,1394.235L757.521,755.777C757.521,735.049 774.349,718.22 795.077,718.22L832.634,718.22C874.09,718.22 907.746,684.563 907.746,643.107C907.746,601.652 874.09,567.995 832.634,567.995L607.296,567.995C586.568,567.995 569.739,584.823 569.739,605.551L569.739,943.558C569.739,964.286 552.911,981.115 532.183,981.115C511.455,981.115 532.183,981.415 532.183,981.415L457.07,981.415ZM1057.972,1356.678L1057.972,793.333C1057.972,751.877 1024.315,718.22 982.859,718.22C941.403,718.22 907.746,751.877 907.746,793.333L907.746,1356.678C907.746,1398.134 941.403,1431.791 982.859,1431.791C1024.315,1431.791 1057.972,1398.134 1057.972,1356.678Z",
  },

  /* A generic database mark: three stacked discs, for a deck that should
     not be wearing anybody's logo. */
  disc: {
    viewBox: [100, 100],
    path: "M50 14c17 0 30 5 30 11s-13 11-30 11-30-5-30-11 13-11 30-11zM20 36c0 6 13 11 30 11s30-5 30-11v14c0 6-13 11-30 11s-30-5-30-11zM20 58c0 6 13 11 30 11s30-5 30-11v14c0 6-13 11-30 11s-30-5-30-11z",
  },

  /* Letters, for the service that has no mark at all. */
  letters: (text) => ({ text }),
};
