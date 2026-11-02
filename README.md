# deckkit

An opinionated library for animated explainer decks. SVG marks, a vocabulary
for pacing them, components that place themselves, and a keyboard-driven
shell to present the result.

Built on [D3](https://d3js.org) for scales, shapes and interpolation and
[GSAP](https://gsap.com) for timelines. No React, no canvas, no runtime
layout engine.

```js
import { slide, scene, setTheme, createDeck } from "deckkit";
import "deckkit/style.css";

const intro = {
  id: "Intro",
  label: "Eight workloads",
  build(svg) {
    const s = slide(svg, { title: "Eight workloads, same 24h period." });
    const small = s.facets(WORKLOADS, {
      points: (w) => w.points,
      name: (w) => w.label,
      marker: (w) => w.peak,
    });
    const say = s.captions(["Same scale. Different peaks, at different hours."]);

    return scene()
      .step(s.open())
      .step(small.beats())
      .beat(say(0))
      .settle();
  },
};

setTheme();
createDeck({ scenes: [intro] });
```

That's a complete scene. There are no coordinates in it.

## Install

```sh
npm install deckkit d3 gsap
```

d3 and gsap are peer dependencies - a deck that bundles its own copy of d3
next to the one its page already loaded is paying twice for the same scales.

## Run the example

```sh
npm install
npm run dev          # opens the sizing deck
npm test             # the time parser
npm run palette      # the colour validator
```

[`examples/sizing`](examples/sizing) is a full seven-scene talk (small
multiples, stacked areas, path morphs, a database cluster losing a node).

It builds to a static folder you can host:

```sh
npx vite build --config examples/sizing/vite.config.js
```

## What is opinionated about it

Most of the library is unremarkable: scales, paths, tweens. These are the
decisions it makes for you, and they're the reason it exists.

**A slide places its own furniture.** You don't pick where the title goes,
how far above the caption the chart stops, or how wide the gutter is when
there's a key. `slide({ title, strap })` puts them at the landmarks in
`core/layout.js` and hands back a region; `s.chart()`, `s.cluster()`,
`s.facets()` fill it. Every deck written without this ends up with a title
at y=58 in one scene and y=62 in the next.

**Nothing takes a colour.** Marks take a *slot* - `{ slot: 3 }` is a series,
`{ status: "critical" }` is state, `{ ink: "muted" }` is type. One function,
`paint()`, resolves all of them, which is what keeps the status/series wall
standing. The moment a deck is one series short and borrows the "bad" red,
every red on screen stops meaning anything.

**Small multiples share one scale.** `facets()` computes a domain across
every item and won't let a facet have its own. n charts that each pick
their own y-max aren't a comparison.

**Components own their arrival.** `cluster.fail(4)` is a step, not a
mutation: it dims the node, shows the badge, split-flaps the throughput
labels and sweeps every surviving meter to its new reading. `annotate()`
comes back with an `arrive()` because everything it draws starts hidden, and
`enter()` on something already at `opacity: 0` animates nothing to nothing.

**Scenes read as running orders.** `.step()` appends, `.hold()` parks,
`.beat()` is the pair, `.settle()` is the dead air at the end. The arrow
keys walk the holds before changing slide, which is what makes this a deck
rather than a folder of videos.

## Layers

```
src/
  core/        the stage, the theme, the landmarks, the arithmetic
    stage.js   W, H, el, svgText, typeset, lines
    theme.js   PALETTES, theme(), setTheme(), paint(), cssVars()
    layout.js  SLOT, region(), tile, grid, row, fitRow, stackColumn
    geometry.js  path arithmetic: rectPerimeter, blockPath, elbow, dodge
    format.js  compact, clock, percent, bytes, duration
    stats.js   series arithmetic over a shared x grid
  marks/       the things a chart is made of
    plot.js    plot(), gridlines(), headroom()
    series.js  series, marker, band, bandPaths
    rule.js    rule, span, annotate
    gauge.js   meter, counter, heat
    bars.js    column, comparison
    key.js     key
  anim/        the pacing layer
    scene.js   scene(), mark()
    steps.js   the step vocabulary
    combinators.js  together, after, each, cascade, beats, when
  components/  the opinionated layer
    slide.js   slide(), card()
    chart.js   chart(), sparkline()
    facets.js  small multiples on one scale
    cluster.js a multi-node database cluster
    flow.js    boxes and arrows
    captions.js  bullets.js  stat.js
  brand/       glyph(), GLYPHS, cylinder(), box()
  deck/        createDeck() and the HUD
```

Most decks import from `components/` and `anim/` only. `marks/` is there for
the one picture a component doesn't cover, and `core/` for the one mark that
doesn't either.

## Components

### `slide(svg, { title, strap, key, box, footnote })`

The hub. Returns the furniture plus a factory for everything that goes on
it, pre-placed: `.chart()`, `.facets()`, `.cluster()`, `.flow()`,
`.bullets()`, `.captions()`, `.stat()`, `.comparison()`, `.sparkline()`,
`.annotate()`. `.open()` is the step that brings the title and strapline in.

`card(svg, rows)` is the other kind of slide: two or three lines in the
middle of an empty stage, typed on one at a time. No region, no caption
slot, because a card with those isn't a card.

### `chart()` and `sparkline()`

```js
const c = s.chart({
  x: { domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: hourTick },
  y: { data: everything, headroom: 1.15 },
  key: [{ label: "eu-west-1", slot: 0 }],
});

c.lines(regions, (r) => r.points, { slot: (r) => r.slot });
c.stack({ rows, keys, slots });
c.rule(9400, { status: "good", label: "+ N-1 headroom" });
c.enter();   // frame, grid and key as one move
```

The frame owns the scales, so `c.line()` can't be on the wrong axis. An
axis spec is a domain, a domain with formatting, or `{ data, headroom }` -
the third is what stops two charts in one deck quietly disagreeing about
their ceiling.

`sparkline()` is deliberately not a chart with everything switched off: no
axis, no labels, no grid, and no draw-on, because a sparkline is read as a
shape and fades in whole.

### `facets(items, { cols, points, name, note, marker, slot })`

Small multiples. Tiles the region, computes one shared domain, and returns
`.beats()` - n items, n holds, each facet landing and then waiting - or
`.all()` for when the grid is context rather than the argument.

### `cluster({ count, glyph, demand, target, pressure })`

A row of nodes, a utilisation meter under each, a throughput figure under
that, and the arithmetic that re-divides load when one leaves.

```js
const c = s.cluster({ count: 7, glyph: GLYPHS.disc, demand: 42000, target: 0.55 });

scene()
  .step(s.open(), c.enter())   // idle
  .beat(c.serve())             // 55% each
  .beat(c.fail(6))             // survivors go to 64%
  .beat(c.heal(6));
```

Demand is a property of the workload, not of the cluster: an outage removes
none of it, it just divides between fewer nodes. Everything the component
does follows from that sentence. State is tracked across the build, so
`fail(2)` after `fail(6)` leaves node 6 down.

Utilisation sweeps (it really does climb) and throughput split-flaps (it
doesn't pass through the values in between - the work is simply re-divided).

### Glyphs

The mark on a node is never the library's to decide, so glyphs are data in
four shapes:

```js
{ path, viewBox, transform }   // inlined SVG. Takes a fill, so it themes.
{ href }                       // an image, for a logo you can't recolour
{ text: "PG" }                 // letters: the honest fallback
null                           // a plain cylinder is a fine node
```

`GLYPHS.cockroach`, `GLYPHS.disc` and `GLYPHS.letters(s)` are provided;
`GLYPHS` is a plain object, so add your own.

### `flow({ nodes, links })`

Boxes and the arrows between them. A link says "from 2 to 5" and the
component works out where the line starts and stops - move a box and the
arrows follow. Arrows leave edges rather than centres and turn at right
angles, because a diagonal between two boxes reads as "related to" where a
right angle reads as "flows into".

### `captions`, `bullets`, `stat`

`captions([...])` is one slot several sentences pass through: `say(2)` takes
down whatever is up and brings up the third. `bullets([...])` keeps them,
for a cumulative argument, with an optional note per point as a second beat.
`stat({ value, lines })` is the hero figure.

## The pacing layer

A step is `(tl, position) => void`. That's the whole contract, so a scene
with a move nothing else makes writes a closure inline rather than waiting
for the library to grow a verb for it.

| step | |
|---|---|
| `enter` `exit` `reveal` `fadeTo` | arriving and leaving; `reveal` is for elements drawn hidden, where `.from()` would animate 0 to 0 |
| `draw` `write` | a stroked path drawn on, a headline typed on |
| `pop` `grow` `pulse` `move` | a marker landing, a bar growing from its baseline, attention, a shift |
| `extend` `attr` `set` | a rule grown to its endpoint; attributes tweened, or set outright for paint |
| `morph` | one path shape into another, via `d3.interpolateString` |
| `track` `drive` `flap` | a driven value with its own renderer; a gauge moving; labels swapped |
| `wait` `raw` | dead air mid-group; anything the vocabulary doesn't cover |

| combinator | |
|---|---|
| `together(...)` | steps that start at the same moment |
| `after(d, ...)` `before(d, ...)` | that group, late or overlapping backwards |
| `each(items, make)` | one step per item, in sequence |
| `cascade(items, overlap, make)` | ...each overlapping into the one before |
| `beats(items, make)` | ...parked between them: n items, n beats |
| `when(cond, ...)` | a conditional step, without breaking the chain |

Steps take timing in their options - `{ duration, at, stagger, ease }`.
`from` is a direction (`above`, `below`, `left`, `right`) rather than a
signed offset, with `distance` to override how far.

### Time

Every time value takes a number of seconds **or** a string with a unit, so
a running order reads as one:

```js
enter(title, { duration: "900ms" })
cascade(bands, "250ms", (b) => draw(b))
scene().settle("1.5s")
```

`at` says where on the timeline a step is inserted:

| `at` | |
|---|---|
| omitted | the end of everything so far |
| `"150ms"` `0.15` | 0.15s after that - a gap |
| `"-400ms"` `-0.4` | 0.4s before it - an overlap |
| `"<"` | the start of the previous tween |
| `"<300ms"` | 0.3s after that start |
| `">200ms"` | 0.2s after the previous tween's end |
| `"@2s"` | absolute: 2s from the top of the scene |
| `"+=0.15"` | GSAP's own syntax, passed through untouched |

One divergence from GSAP worth knowing: a **bare number is relative to the
end**, where GSAP reads it as absolute. A scene is a running order, and in
a running order "a beat later" is what you mean nearly always and "1.8
seconds from the top" is what you mean nearly never. `"@"` is there for the
never.

The units are timeline seconds. The speed control calls `timeScale()` on
the whole timeline, so every gap and overlap stretches by the same factor
and the pacing you composed survives someone presenting at half speed.

A position handed down by a combinator wins, and a per-step `at` inside one
is ignored:

```js
.beat(enter(x, { at: "500ms" }))             // honoured
.beat(together(enter(x, { at: "500ms" })))   // ignored - use after(...) instead
```

That's deliberate: `together()` means *these start at the same moment*.

There's no path-morph plugin. Shapes generated with matching point counts
and matching command sequences interpolate exactly under
`d3.interpolateString`; `rectPerimeter()` exists to give a rectangle the
same number of points as the curve it's replacing, which is what makes the
interpolation legal.

## Colour

A theme has six layers - surfaces, ink, chrome, status, series, weight - and
the status/series split is the one worth defending.

`npm run palette` is the validator, and it's what makes "validated" a fact
rather than a habit. Five checks, each a way a categorical palette fails on
a projector: lightness band, chroma floor, CVD separation between adjacent
slots, normal-vision separation, and contrast against the surface. Colour
vision is simulated with Viénot, Brettel & Mollon (1999) - an LMS
projection, not a hue rotation - and ΔE is Euclidean distance in OKLab.

Two ramps ship:

| | worst adjacent ΔE | |
|---|---|---|
| `safe8` | 12.3 | the default; passes every check |
| `pastel8` | 1.0 under deuteranopia | the softer house look; **doesn't pass** |

`pastel8` is kept because decks already wear it, and the validator prints
its failures on every run. Slots 5 and 6 - the cornflower and the lavender -
are indistinguishable to a deuteranopic viewer, and they're adjacent in
every stacked area. Use it where a presenter is naming each series out loud;
use `safe8` where the picture has to carry the identification on its own.

Slot order is the safety mechanism, so it's also the stack order. `safe8`'s
order is the output of an exhaustive search over all 40,320 orderings of its
eight hues for the one that maximises the worst adjacent pair - reordering
it undoes the property it was chosen for.

`setTheme()` publishes the theme to CSS as `--surface`, `--ink-2`,
`--series-5` and the rest, so the HUD and the chart can't drift apart.

## The deck shell

```js
createDeck({ scenes, mount = document.body, speed = 1, hud = true, start = 0 });
```

| key | |
|---|---|
| `->` `space` | next beat; next scene once the current one has no beats left |
| `<-` | previous beat, or back to the previous scene's finished frame |
| `r` | replay the current scene |
| `s` | speed menu - 0.1× to 2×, in nine steps |
| `h` | hide the controls; the slide grows into the space |
| `Esc` | close the menu, or bring the controls back |
| `f` | fullscreen |

Scenes are built on first visit, so a deck doesn't stall on load. Forward
plays; backward lands on the finished frame, because "go back" almost always
means "show me that chart again". `?slide=3` deep-links, and `&frame=end`
opens on the finished state rather than playing it in.

Because every scene is one GSAP timeline, `timeScale()` stretches every tween
and every hold at once - so the ratios a scene was composed with survive the
speed control. A talk never runs at the pace the choreography was written to.

## Writing a scene

Draw first, choreograph second.

```js
export default {
  id: "Verdict",
  label: "Before and after",

  build(svg) {
    const s = slide(svg, { title: "Before and after" });
    const { tall, short, gap, label } = s.comparison({ high, low, /* ... */ });
    const verdict = s.stat({ value: "48%", lines: ["bought and never used"] });

    return scene()
      .step(s.open(), grow(tall.bar))
      .beat(grow(short.bar))
      .beat(enter([gap, label]))
      .beat(verdict.enter())
      .settle();
  },
};
```

`build(svg)` draws everything up front and hands back a paused timeline. The
deck does the rest.
