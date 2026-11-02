/* Time, in units you can read.

   GSAP counts in bare seconds and writes positions in its own little
   language: `"+=0.15"`, `"-=0.4"`, `"<0.3"`. It's terse and it's precise,
   and it's also the thing a newcomer to a deck has to be taught before
   they can read a running order. `0.15` isn't obviously a sixth of a
   second when it's sitting in an options bag next to a `distance` of 8 and
   a `stagger` of 0.028.

   So every time value in deckkit takes a number of seconds *or* a string
   with a unit on it, and this is the one place that converts:

     150            0.15s? 150s? - a number is always seconds: 150s
     "150ms"        0.15
     "1.5s"         1.5
     "-400ms"       -0.4

   And positions - where on the timeline a step is inserted - get the same
   treatment, so a scene says `at: "150ms"` rather than `at: "+=0.15"`:

     "150ms"        0.15s after the end of everything so far   (+=)
     "-400ms"       0.4s before it: an overlap                 (-=)
     "<"            the start of the previous tween
     "<300ms"       0.3s after that start
     ">200ms"       0.2s after the previous tween's end
     "@2s"          absolute: 2s from the top of the scene
     "myLabel"      a label, handed to GSAP untouched
     "+=0.15"       GSAP's own syntax, also handed over untouched

   The one place this diverges from GSAP is worth knowing: in GSAP a bare
   number position is *absolute*, and here it's relative to the end. That
   is deliberate - a scene is a running order, and in a running order
   "quarter of a second later" is what you mean approximately always, while
   "1.8 seconds from the top of the scene" is a thing you mean never. `@`
   is there for the never. */

const DURATION = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(ms|s)?$/i;

/* A duration, in seconds. Numbers pass through; strings carry a unit.

   An unparseable string comes back as-is rather than as NaN, because the
   caller may be holding a GSAP label and the alternative is a tween that
   silently lands at time zero. */
export function secs(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const match = DURATION.exec(value.trim());
  if (!match) return value;
  const n = Number(match[1]);
  return match[2] && match[2].toLowerCase() === "ms" ? n / 1000 : n;
}

/* A position on the timeline, as GSAP wants it. */
export function at(spec) {
  if (spec === undefined || spec === null) return undefined;
  if (typeof spec === "number") return spec < 0 ? `-=${-spec}` : `+=${spec}`;
  if (typeof spec !== "string") return spec;

  const text = spec.trim();
  if (!text) return undefined;

  // Absolute, the rare case.
  if (text[0] === "@") {
    const value = secs(text.slice(1));
    return typeof value === "number" ? value : text;
  }

  // Relative to the previous tween rather than to the end of the timeline.
  if (text[0] === "<" || text[0] === ">") {
    const rest = text.slice(1).trim();
    if (!rest) return text[0];
    const value = secs(rest);
    return typeof value === "number" ? `${text[0]}${value}` : text;
  }

  // GSAP's own relative syntax, or a label with an offset on it. Both
  // contain an `=`, and both are already exactly what GSAP wants.
  if (text.includes("=")) return text;

  const value = secs(text);
  if (typeof value !== "number") return text;   // a bare label
  return value < 0 ? `-=${-value}` : `+=${value}`;
}

/* The timing properties inside a step's options, converted in place.

   Everything GSAP measures in seconds, so that a scene can write
   `{ duration: "700ms" }` anywhere it could have written `{ duration: 0.7 }`.
   `stagger` is left alone when it's an object, which is GSAP's advanced
   form and carries its own units inside it. */
const TIMED = ["duration", "delay", "stagger", "repeatDelay", "endDelay"];

export function timing(vars) {
  const out = { ...vars };
  for (const key of TIMED) {
    if (out[key] === undefined) continue;
    if (key === "stagger" && typeof out[key] === "object") continue;
    out[key] = secs(out[key]);
  }
  return out;
}
