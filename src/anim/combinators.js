/* Putting steps together.

   Everything here takes steps and returns a step, so a running order stays
   one expression however deeply it nests. */

import { mark } from "./scene.js";
import { secs } from "../core/time.js";

const flatten = (steps) => steps.flat(Infinity).filter(Boolean);

/* Steps that start together.

   Pinned to a shared label rather than chained with "<", because a step is
   free to append more than one tween - morph() appends two - and "<" would
   line the group up on the last of them instead of on the group's start. */
export const together = (...steps) => (tl, position) => {
  const label = mark(tl, position);
  flatten(steps).forEach((s) => s(tl, label));
};

/* A step, late. Reads as "half a second after the rest of this group", and
   `after("500ms", ...)` says so out loud. */
export const after = (delay, ...steps) => (tl, position) => {
  const label = typeof position === "string" ? position : mark(tl, position);
  flatten(steps).forEach((s) => s(tl, `${label}+=${secs(delay)}`));
};

/* A step, early - overlapping back into what came before it. */
export const before = (lead, ...steps) => (tl, position) => {
  flatten(steps).forEach((s) => s(tl, position ?? `-=${secs(lead)}`));
};

/* One step per item, in sequence. The `at` of the first is honoured and the
   rest follow it, so a loop over eight facets stays one expression. */
export const each = (items, make) => (tl, position) =>
  items.forEach((item, i) => make(item, i)(tl, i ? undefined : position));

/* One step per item, each overlapping back into the one before it.

   Eight things arriving in quick succession read as one gesture rather than
   as eight; the overlap is what does that. The first starts cleanly at the
   group's own position, so a cascade that opens a beat doesn't reach
   backwards into the hold before it. */
export const cascade = (items, overlap, make) => (tl, position) => {
  const step = `-=${secs(overlap)}`;
  items.forEach((item, i) => make(item, i)(tl, i ? step : position));
};

/* One step per item, parked between them: n items, n beats.

   The loop a scene would otherwise break its chain to write. Eight series
   that each land and then wait is one expression, and the running order
   still reads as a running order. */
export const beats = (items, make) => (tl, position) =>
  items.forEach((item, i) => {
    if (i) tl.hold();
    make(item, i)(tl, i ? undefined : position);
  });

/* Run a step only when the condition holds. Keeps a conditional beat inside
   the chain instead of breaking the scene into statements around it. */
export const when = (condition, ...steps) => (tl, position) => {
  if (condition) flatten(steps).forEach((s) => s(tl, position));
};

/* Escape hatch: anything the vocabulary doesn't cover, still as a step.
   `raw((tl, at) => tl.to(...))` composes with together() and friends. */
export const raw = (fn) => (tl, position) => fn(tl, position);

/* A step bundle as a single step, so a component can hand back several
   moves and a scene can treat them as one. */
export const all = (...steps) => (tl, position) => {
  const flat = flatten(steps);
  if (!flat.length) return;
  const label = mark(tl, position);
  flat.forEach((s) => s(tl, label));
};
