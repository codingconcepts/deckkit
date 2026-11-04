# deckkit

An opinionated library for animated explainer decks. SVG marks, a vocabulary for pacing them, components that place themselves, and a keyboard-driven shell to present the result.

Built on [D3](https://d3js.org) for scales, shapes and interpolation and [GSAP](https://gsap.com) for timelines. No React, no canvas, no runtime layout engine.

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

### Install

```sh
npm install deckkit d3 gsap
```

d3 and gsap are peer dependencies - a deck that bundles its own copy of d3 next to the one its page already loaded is paying twice for the same scales.

### Run the example

```sh
npm install
npm run dev          # opens the sizing deck
npm test             # the time parser and the frame plan
npm run palette      # the colour validator
npm run export -- --dir examples/sizing/dist   # the deck as an mp4
```

[`examples/sizing`](examples/sizing) is a full seven-scene talk (small multiples, stacked areas, path morphs, a database cluster losing a node).

It builds to a static folder you can host:

```sh
npx vite build --config examples/sizing/vite.config.js
```

### What it's opinionated about it

Most of the library is unremarkable: scales, paths, tweens. These are the decisions it makes for you, and they're the reason it exists.

**A slide places its own furniture.** You don't pick where the title goes, how far above the caption the chart stops, or how wide the gutter is when there's a key. `slide({ title, strap })` puts them at the landmarks in `core/layout.js` and hands back a region; `s.chart()`, `s.cluster()`, `s.facets()` fill it. Every deck written without this ends up with a title at y=58 in one scene and y=62 in the next.

**Nothing takes a colour.** Marks take a *slot* - `{ slot: 3 }` is a series, `{ status: "critical" }` is state, `{ ink: "muted" }` is type. One function, `paint()`, resolves all of them, which is what keeps the status/series wall standing. The moment a deck is one series short and borrows the "bad" red, every red on screen stops meaning anything.

**Small multiples share one scale.** `facets()` computes a domain across every item and won't let a facet have its own. n charts that each pick their own y-max aren't a comparison.

**Components own their arrival.** `cluster.fail(4)` is a step, not a mutation: it dims the node, shows the badge, split-flaps the throughput labels and sweeps every surviving meter to its new reading. `annotate()` comes back with an `arrive()` because everything it draws starts hidden, and `enter()` on something already at `opacity: 0` animates nothing to nothing.

**Scenes read as running orders.** `.step()` appends, `.hold()` parks, `.beat()` is the pair, `.settle()` is the dead air at the end. The arrow keys walk the holds before changing slide, which is what makes this a deck rather than a folder of videos.

### Layers

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
  deck/        createDeck(), the HUD, and capture mode
  export/      the recorder: mp4 and gif, from a terminal
```

Most decks import from `components/` and `anim/` only. `marks/` is there for the one picture a component doesn't cover, and `core/` for the one mark that doesn't either.

### Components

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

### The pacing layer

A step is `(tl, position) => void`. A scene
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

### Colour

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

### The deck shell

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

### Export

A deck is a web page, which is the right shape for a talk and the wrong
shape for everything that happens afterwards. A conference wants an mp4, a
README wants a gif, and a pull request wants one scene rather than seven.

```sh
# one mp4 of the lot
npx deckkit export --dir examples/sizing/dist

# Just scenes 2, 3, and 4 (as one output file)
npx deckkit export --dir dist --scene 2,3,4

# Just scenes 2, 3, and 4 (as separate output files)
npx deckkit export --dir dist --scene 2,3,4 --split

# one file per scene
npx deckkit export --dir dist --split

# just that one
npx deckkit export --dir dist --scene Verdict --format gif

# what's in the deck
npx deckkit export --url http://localhost:5173/ --list
```

`--dir` is a built deck, served on loopback for the length of the job;
`--url` is one already being served, so a dev server works and so does a
deployed deck. Needs ffmpeg on `PATH` and Chrome installed (`CHROME_PATH`
overrides the search).

| | |
|---|---|
| `--out` `--name` | where the files go, and what the combined one is called |
| `--format` | `mp4`, `gif`, or `mp4,gif` - both, from one pass |
| `--split` | every scene separately, named after the scene |
| `--scene <id\|n>` | one scene, by id or by HUD position. Repeatable |
| `--fps` `--hold` `--tail` `--speed` | frame rate; how long to sit on a beat, and on the last frame; how fast a scene runs |
| `--width` `--height` `--scale` | frame size; `--scale 2` renders retina |
| `--quality` | `draft`, `good`, `best`; every number under one is also a flag |

### Which scenes, and in what order

`--scene` takes an id or a HUD position, and it repeats:

```sh
deckkit export --dir dist --scene Verdict                    # one file
deckkit export --dir dist --scene Intro --scene Verdict      # both, one file
deckkit export --dir dist --scene 2,5 --split                # both, two files
```

Several scenes come out in **the order they were asked for**, not in deck
order. A list of scenes is an edit, and an edit that silently reorders
itself isn't one.

A file per scene is named after the scene, splitting on the capitals -
so `S2PeaksInTime` exports as
`s2-peaks-in-time.mp4`, which is the name of the file the scene is
written in. Only the combined file takes `--name`.

### Pace

`--speed` is how fast a scene runs in the file, and it takes either a
number for the whole deck or a value per scene, by id or position:

```sh
deckkit export --dir dist --speed 1.5
deckkit export --dir dist --speed 1.5 --speed Verdict=0.75 --hold Intro=3
```

It moves the sampling rather than the timeline - at 2x each output frame
advances two frames' worth of scene - so the file still plays at `--fps`
and the easing is the easing that was composed. `--hold` works the same
way and is deliberately *not* scaled by `--speed`: a beat is a thing the
viewer reads, so its length belongs on the viewer's clock, and speeding
the animation up then flashing the result past in half the time is two
changes where one was asked for.

A deck composed for a room is usually a touch slow for a gif in a README
and about right for the one scene somebody is going to pause on, which is
why this is per scene rather than per deck.

`--hold 0 --tail 2` is the shape of a looping gif: no parking mid-scene,
then two seconds on the finished picture before it starts over.

```sh
deckkit export --dir dist --scene Verdict --format gif --hold 0 --tail 2
```

The two are separate numbers because the last frame of a scene is a
different thing to the beats inside it. A gif loops, so the finished
picture is the only part a reader ever gets to study - and without a tail
it's the part that gets a thirtieth of a second before the stage empties
and it all starts again. `--tail` takes per-scene values too, which in a
combined export is a breath between scenes rather than a hard cut.

### Quality

`--quality` is the one knob worth turning: `draft` while you're checking
the choreography, `good` by default, `best` for the file that gets
uploaded once.

| | crf | x264 preset | gif | supersample |
|---|---|---|---|---|
| `draft` | 30 | veryfast | 10fps, 640px, 64 colours | 1x |
| `good` | 18 | slow | 15fps, 960px, 256 colours | 1x |
| `best` | 14 | slower | 20fps, 1280px, 256 colours | 2x |

Every number in that table is also a flag - `--crf`, `--preset`,
`--gif-fps`, `--gif-width`, `--gif-colors`, `--gif-dither`,
`--supersample` - and anything said explicitly wins, so a preset is a
starting point rather than a ceiling.

`--supersample 2` renders at twice the output size and lets ffmpeg bring
it down. Chrome antialiases SVG perfectly well, so that isn't fixing
jaggies: it's what keeps thin strokes and small type from going soft when
a gif then halves the width again. It costs four times the pixels per
screenshot, which is why only `best` asks for it.

The gif defaults are chosen for what a deck actually is - flat fills and
sharp type on a dark plane. `--gif-dither bayer` beats error diffusion
here because diffusion stipples every background it can't match exactly,
and a stippled background is both ugly and large, nothing compressing
less well than noise. `fine` is there for the deck with a gradient in it.

**Nothing is played.** The recorder seeks the scene's timeline to an exact
time and takes a picture, `fps` times per second of scene - so the output
is identical on a busy laptop and an idle one, and a 30fps file is actually
30 distinct frames a second rather than whatever the compositor managed.
That only works because nothing in the library draws from a clock: every
value on screen, including the ones drawn by `onUpdate` - morphs, counters,
meters, split-flaps - is a function of timeline position.

**A hold becomes a still.** The thing that makes a deck a deck is the
parking: a scene stops partway through and waits for the next sentence.
Nobody says that sentence to a recording, so each hold is rendered as
`--hold` seconds of the same frame. Drop them instead and every scene cuts
the moment it lands, which reads as a glitch rather than as pacing. The
file therefore runs longer than the timeline - a 12s scene with six beats
is about 21s at the default - which is the right answer for a video and
the reason the number is a flag.

The screenshots are a hundred times the cost of the encoding, so `mp4,gif`
records once and feeds two encoders, and a held frame is captured once and
written as many times as it lasts.

There's no browser automation library behind this. The DevTools protocol
is a WebSocket, Node has had one built in since 22, and the whole job is
navigate, evaluate, screenshot - which is a cheaper thing to maintain than
a dependency that downloads a second copy of Chromium onto every machine
that installs the library, for a feature most decks never run.

### Capture mode

The recorder drives the deck through `window.__deckkit__.capture`, which
`createDeck()` publishes and also returns:

```js
const deck = createDeck({ scenes });

deck.capture.begin();        // build every scene, hide the HUD, 1x speed
deck.capture.scenes();       // [{ index, id, label, duration, stops }]
deck.capture.select(2);      // that scene, alone, rewound
deck.capture.seek(4.25);     // rendered at exactly 4.25s, callbacks and all
deck.capture.end();
```

It's the same seek the arrow keys use, with the callbacks left switched
on - suppress them and every `onUpdate`-drawn thing on the slide keeps
whatever shape it was last rendered at, which is how a morph ends up frozen
mid-curve for the rest of the film.

Anything that wants frames can use it: a different encoder, a contact
sheet, a screenshot test that asserts on scene 4 at 2.5 seconds.

### Writing a scene

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
