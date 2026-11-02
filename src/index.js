/* deckkit: animated explainer decks, assembled rather than drawn.

   Four layers, and the order matters:

     core/        the stage, the theme, the landmarks, the arithmetic
     marks/       the things a chart is made of
     anim/        the pacing vocabulary - a scene reads as a running order
     components/  the opinionated layer: a slide places its own furniture

   Most decks only ever import from components/ and anim/. The marks are
   there for the one picture a component doesn't cover, and core/ is there
   for the one mark that doesn't either. */

// ---- core
export { W, H, el, group, svgText, body, headline, typeset, lines, textWidth } from "./core/stage.js";
export { THEME, PALETTES, THEME_DEFAULTS, theme, setTheme, cssVars, paint, slotColour } from "./core/theme.js";
export { compact, unit, clock, hourTick, percent, bytes, duration, thousands, signed } from "./core/format.js";
export {
  primeDrawOn, rectPerimeter, polyline, blockPath, dodge, roundRect, elbow, arrowHead,
} from "./core/geometry.js";
export {
  MARGIN, SLOT, region, keyAnchor, centreOf, tile, grid, row, fitRow, stackColumn, columnsAt,
} from "./core/layout.js";
export { stats } from "./core/stats.js";
export { secs, at, timing } from "./core/time.js";

// ---- marks
export { plot, gridlines, headroom } from "./marks/plot.js";
export { series, marker, band, bandPaths } from "./marks/series.js";
export { rule, span, annotate } from "./marks/rule.js";
export { meter, counter, heat } from "./marks/gauge.js";
export { column, comparison } from "./marks/bars.js";
export { key } from "./marks/key.js";

// ---- brand
export { glyph, GLYPHS, normaliseGlyph } from "./brand/glyph.js";
export { cylinder, box, NODE } from "./brand/cylinder.js";

// ---- pacing
export { scene, mark } from "./anim/scene.js";
export { nodes } from "./anim/targets.js";
export { together, after, before, each, cascade, beats, when, raw, all } from "./anim/combinators.js";
export {
  enter, reveal, exit, fadeTo, draw, write, pop, grow, pulse, move,
  extend, set, attr, track, drive, flap, morph, wait,
} from "./anim/steps.js";

// ---- components
export { slide, card } from "./components/slide.js";
export { captions } from "./components/captions.js";
export { chart, sparkline } from "./components/chart.js";
export { facets } from "./components/facets.js";
export { cluster } from "./components/cluster.js";
export { stat } from "./components/stat.js";
export { bullets } from "./components/bullets.js";
export { flow } from "./components/flow.js";

// ---- shell
export { createDeck } from "./deck/deck.js";
