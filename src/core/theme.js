/* Colour, weight and type: the one place a deck says what it looks like.

   A theme has six layers, and the separation is load-bearing rather than
   tidiness:

     surfaces  what the marks sit on
     ink       type, in three weights of recession
     chrome    axes and gridlines, which must stay under the data
     status    reserved for state, and never reused as another series
     series    the categorical slots, in an order that's itself the
               colourblind-safety mechanism
     weight    stroke widths and the type family

   The status/series split is the one worth defending. The moment a deck is
   one series short and borrows the "bad" red, every red on screen stops
   meaning anything. Eight is the ceiling; a ninth category folds into
   "Other" rather than getting a new hue.

   This is also the opinionated bit of the library people notice first:
   nothing in deckkit takes a colour. Marks take a *slot*, and the slot is
   resolved here. If you want a mark in your brand's teal, put the teal in
   slot 3 - don't pass it to a series. */

/* Categorical ramps, validated against a dark chart surface.

   Each has been checked for lightness band, chroma floor, CVD separation,
   normal-vision floor and contrast - `npm run palette` is the validator,
   and it's the thing that makes "validated" a fact rather than a claim.
   Slot order is the safety mechanism, so it's also the stack order:
   adjacent bands in a stacked area are adjacent slots. Reorder one and you
   reorder the other, and re-run the validator. */
export const PALETTES = {
  /* The default. Eight pastel steps that pass every check:

       lightness band  0.161   (limit 0.22)
       min chroma      0.108   (floor 0.045)
       min contrast    8.4:1   on the default surface
       worst adjacent  dE 12.3 across normal vision and all three dichromats

     The order isn't decorative. It's the output of an exhaustive search
     over the 40,320 orderings of these eight hues for the one that
     maximises the worst adjacent pair - so reordering it undoes the
     property it was chosen for. */
  safe8: [
    "#9ee88f", "#ff9ee8", "#f2f07a", "#6fe4f5",
    "#ffc46b", "#8fb4ff", "#ff9d9d", "#c0a8ff",
  ],

  /* The softer house look, kept because several decks already wear it.

     It doesn't pass. Slots 5 and 6 - the cornflower and the lavender -
     sit at dE 5.6 in normal vision and dE 1.0 under deuteranopia, which
     for two bands that are adjacent in every stacked area means a
     deuteranopic viewer can't tell them apart at all. `npm run palette`
     prints this every run.

     Use it where the slides are decoration around a presenter who is
     naming each series out loud; use safe8 where the picture has to carry
     the identification on its own. */
  pastel8: [
    "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf",
    "#9bf6ff", "#a0c4ff", "#bdb2ff", "#ffc6ff",
  ],
};

/* The defaults a theme fills in around whatever it's given.

   A second deck overrides the handful of values that differ and inherits
   the rest, rather than copying a palette it's then free to drift from. */
export const THEME_DEFAULTS = {
  // Surfaces.
  surface: "#1a1a19", // chart surface, and the gap between stacked fills
  plane: "#0d0d0d",   // page plane, behind the chart

  // Ink.
  ink: "#f0efec",     // primary: headlines, hero figures
  ink2: "#c3c2b7",    // secondary: legend, annotations
  muted: "#898781",   // axis labels, tick text

  // Chrome.
  grid: "#2c2c2a",    // hairline gridlines, solid
  axis: "#383835",    // baseline and axis rules

  // Status. Reserved for state, never reused as another series.
  critical: "#d03b3b",
  good: "#0ca30c",
  warn: "#c98500",

  // Furniture: the body of a drawn object, and the face that catches light.
  node: "#2a2a28",
  nodeLid: "#3e3e3a",

  // Weight. Thin marks, recessive chrome - this is house style rather than
  // a per-chart decision, which is why it lives in the theme and not in an
  // options bag.
  lineWidth: 2.0,
  hairline: 1.0,
  gapWidth: 2.0,

  font: '"Helvetica Neue", Helvetica, Arial, sans-serif',

  series: PALETTES.safe8,
};

export const theme = (overrides = {}) => ({ ...THEME_DEFAULTS, ...overrides });

let active = theme();

/* The live theme.

   A proxy rather than a plain object so that every module can `import
   { THEME }` once at load and still see a theme installed later - which is
   what lets a deck call setTheme() in its entry file instead of threading a
   theme object through forty function signatures. */
export const THEME = new Proxy(
  {},
  {
    get: (_, key) => active[key],
    has: (_, key) => key in active,
    ownKeys: () => Reflect.ownKeys(active),
    getOwnPropertyDescriptor: (_, key) => ({
      value: active[key],
      enumerable: true,
      configurable: true,
    }),
  },
);

/* Install a theme, and publish it to CSS. Returns the live THEME. */
export function setTheme(overrides = {}) {
  active = theme(overrides);
  if (typeof document !== "undefined") cssVars(active);
  return THEME;
}

/* A series colour, by slot.

   Wraps rather than throws past the end of the ramp, because a deck that
   crashes on its ninth series in front of a room is worse than one that
   repeats a hue - but the validator and the docs both say eight, and a
   ninth category should be folding into "Other" instead. */
export const slotColour = (slot = 0) => active.series[slot % active.series.length];

/* Resolve the colour of a mark.

   The single chokepoint for "what colour is this". `{ slot: 3 }` is a
   series, `{ status: "critical" }` is state, `{ ink: "muted" }` is type, and
   a bare string is an escape hatch for the one-off that genuinely isn't any
   of those. Everything that draws goes through here, so the status/series
   wall is enforced by the code rather than by a convention people remember
   for three scenes. */
export function paint(spec, fallback = active.ink) {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === "string") return active[spec] ?? spec;
  if (typeof spec === "number") return slotColour(spec);
  if (spec.colour) return spec.colour;
  if (spec.slot !== undefined) return slotColour(spec.slot);
  if (spec.status) return active[spec.status] ?? fallback;
  if (spec.ink) return active[spec.ink] ?? fallback;
  return fallback;
}

/* Publish a theme to CSS, so the page and the chart can't disagree.

   The HUD is HTML and a deck is SVG, and without this they each carry their
   own copy of the same six hex values. Changing a palette then means
   changing it twice, and forgetting the second one leaves a scrubber tinted
   for the old deck. The stylesheet asks for var(--surface); this is where
   that comes from. */
export function cssVars(t = active, root = document.documentElement) {
  for (const [key, value] of Object.entries(t)) {
    if (key === "series" || typeof value !== "string") continue;
    // ink2 -> --ink-2, nodeLid -> --node-lid
    root.style.setProperty(`--${key.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase()}`, value);
  }
  t.series.forEach((colour, i) => root.style.setProperty(`--series-${i}`, colour));
}
