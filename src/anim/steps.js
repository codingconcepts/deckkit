/* The step vocabulary: the moves a deck actually makes.

   Nothing here knows about charts or clusters - it's GSAP and SVG nodes.
   A step is `(tl, position) => void`, and every one of these returns one. */

import * as d3 from "d3";
import { nodes } from "./targets.js";
import { mark } from "./scene.js";
import { at as position, secs, timing } from "../core/time.js";

/* Where an element travels in from. A direction rather than a signed pixel
   offset, so a scene says what it means and the distances stay consistent
   across the deck. */
const TRAVEL = { above: { y: -12 }, below: { y: 10 }, left: { x: -12 }, right: { x: 12 } };

const travel = (from, distance) => {
  if (!from) return {};
  const axis = TRAVEL[from] || {};
  const [key, value] = Object.entries(axis)[0] || [];
  if (!key) return {};
  return { [key]: distance === undefined ? value : Math.sign(value) * distance };
};

/* Split a step's options into the bits this layer reads and the GSAP vars to
   pass through, so any tween property can be set on any step without the
   factory having to know about it. Durations go through the time parser on
   the way, so `{ duration: "700ms" }` works anywhere `{ duration: 0.7 }`
   does. */
const vars = ({ at, from, distance, ...rest }) => timing(rest);

/* Where a step lands.

   A position handed down by a combinator always wins: `together()` means
   "these start at the same moment", and a per-step `at` inside it would be
   contradicting the thing the caller just asked for. */
const where = (given, opts) => given ?? position(opts.at);

// ---------------------------------------------------------------- arriving

/* Fade in, optionally travelling. For elements drawn at their final state -
   the common case, since most of a scene is built visible and animated from
   nothing. */
export const enter = (target, opts = {}) => (tl, position) =>
  tl.from(nodes(target), {
    opacity: 0, duration: 0.7, ...travel(opts.from, opts.distance), ...vars(opts),
  }, where(position, opts));

/* Fade in an element that was drawn hidden.

   Not the same move as enter(): .from() on something already at opacity 0
   animates from 0 to 0. Anything created with { opacity: 0 } - because it
   is the second of two captions sharing a slot, or because it would read as
   a value before its beat - needs the explicit fromTo. */
export const reveal = (target, opts = {}) => (tl, position) => {
  const travelled = travel(opts.from, opts.distance);
  // Home only on the axis it travelled along: zeroing both would reset a
  // transform the scene set deliberately on the other one.
  const home = Object.fromEntries(Object.keys(travelled).map((k) => [k, 0]));
  return tl.fromTo(nodes(target),
    { opacity: 0, ...travelled },
    { opacity: 1, ...home, duration: 0.7, ...vars(opts) },
    where(position, opts));
};

export const exit = (target, opts = {}) => (tl, position) =>
  tl.to(nodes(target), {
    opacity: 0, duration: 0.4, ...travel(opts.from, opts.distance), ...vars(opts),
  }, where(position, opts));

/* Fade to a given opacity rather than to nothing: a node dimmed because it
   is down, not gone, or a caption drawn hidden that only needs to arrive. */
export const fadeTo = (target, opacity, opts = {}) => (tl, position) =>
  tl.to(nodes(target), { opacity, duration: 0.8, ...vars(opts) }, where(position, opts));

// ------------------------------------------------------------------ drawing

/* Draw a stroked path on, left to right. Expects primeDrawOn() to have set
   the dash pattern at build time; linear, because a line being drawn with an
   ease on it reads as a hand speeding up. */
export const draw = (target, opts = {}) => (tl, position) =>
  tl.to(nodes(target), { strokeDashoffset: 0, duration: 0.9, ease: "none", ...vars(opts) },
        where(position, opts));

/* Type a headline on, character by character.

   The other half of typeset(): fill-opacity only, because SVG 1.1 doesn't
   honour a transform on a tspan, so there's no shift to stagger alongside
   it. Linear, and fast enough per character that the stagger is the effect. */
export const write = (target, opts = {}) => (tl, position) =>
  tl.to(nodes(target), {
    fillOpacity: 1, duration: 0.5, stagger: 0.028, ease: "none", ...vars(opts),
  }, where(position, opts));

/* A marker arriving: a small scale-up under the fade, so the eye catches it
   against a chart that's otherwise still. */
export const pop = (target, opts = {}) => (tl, position) =>
  tl.from(nodes(target), {
    opacity: 0, scale: 0.5, duration: 0.4, transformOrigin: "50% 50%", ...vars(opts),
  }, where(position, opts));

/* A bar growing from its own baseline. scaleY against a bottom origin rather
   than a height tween, so whatever is captioned underneath stays put. */
export const grow = (target, opts = {}) => (tl, position) =>
  tl.from(nodes(target), {
    scaleY: 0, duration: 1.0, transformOrigin: "50% 100%", ease: "power2.out", ...vars(opts),
  }, where(position, opts));

/* Attention, without a colour change: one short breath in and out.

   For the moment a presenter says "this one" about something already on
   screen. Deliberately small - a mark that jumps 20% reads as a bug. */
export const pulse = (target, opts = {}) => (tl, position) => {
  const { scale = 1.12, duration = 0.5, repeat = 0 } = opts;
  tl.to(nodes(target), {
    scale, duration: duration / 2, yoyo: true, repeat: repeat * 2 + 1,
    transformOrigin: "50% 50%", ease: "power2.inOut", ...vars(opts),
  }, where(position, opts));
};

/* Shift something to a new place on the stage, in stage pixels. */
export const move = (target, { dx = 0, dy = 0, ...opts } = {}) => (tl, position) =>
  tl.to(nodes(target), { x: dx, y: dy, duration: 0.9, ease: "power2.inOut", ...vars(opts) },
        where(position, opts));

// ------------------------------------------------------------- attributes

/* Extend a line to a new x. For rules and thresholds, which are grown by
   their own endpoint because the dash pattern is the mark and so can't
   double as the draw-on. */
export const extend = (target, x2, opts = {}) => (tl, position) =>
  tl.to(nodes(target), { attr: { x2 }, duration: 0.9, ...vars(opts) }, where(position, opts));

/* Set attributes outright, at a point in the running order. For paint, which
   AttrPlugin can't interpolate, and for anything invisible at the moment it
   changes. */
export const set = (target, attrs, opts = {}) => (tl, position) =>
  tl.set(nodes(target), { attr: attrs, ...vars(opts) }, where(position, opts));

/* Tween attributes. The general form behind extend(), for the one-off cases:
   fill-opacity, stroke-width, a radius. */
export const attr = (target, attrs, opts = {}) => (tl, position) =>
  tl.to(nodes(target), { attr: attrs, duration: 0.9, ...vars(opts) }, where(position, opts));

// ------------------------------------------------------------ driven values

/* Drive a value and redraw from it: the GSAP equivalent of Manim's
   ValueTracker, and the only way to animate something whose shape is
   computed rather than tweened - a counter's text, a meter's width and
   colour.

   `state` is the object the renderer reads, so the caller keeps hold of it
   and the render function stays next to the thing it draws. */
export const track = (state, to, render, opts = {}) => (tl, position) =>
  tl.to(state, { ...to, duration: 1.0, ...vars(opts), onUpdate: render }, where(position, opts));

/* Move a gauge to a new reading.

   track() with the proxy and the renderer already paired up. Anything that
   comes back as {state, render} - a meter, a counter - moves with this, so a
   scene never has to hold the proxy object itself or remember which of the
   two arguments is the one that redraws. */
export const drive = (gauge, value, opts = {}) =>
  track(gauge.state, { value }, gauge.render, opts);

/* Swap one set of labels for another, in place.

   A split-flap rather than a count: when a number jumps because the work
   was re-divided, it never passed through the values in between, and a
   counter ticking between them would imply a ramp that didn't happen. */
export const flap = (from, to, opts = {}) => (tl, position) => {
  const label = mark(tl, where(position, opts));
  const duration = opts.duration ?? 0.5;
  tl.to(nodes(from), { opacity: 0, y: 12, duration }, label)
    .fromTo(nodes(to), { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration }, label);
};

/* Morph a path's shape.

   Shapes generated with matching point counts and matching command
   sequences interpolate exactly under d3.interpolateString, which is why
   geometry.js goes to the trouble of walking a rectangle at equal arc
   length.

   `fromD` is explicit rather than read off the element because the whole
   timeline is built before a frame plays - at build time the path still
   holds its first shape, so a second morph reading the live attribute would
   interpolate from the wrong place. */
export const morph = (target, fromD, toD, opts = {}) => (tl, position) => {
  const path = d3.select(nodes(target)[0]);
  const interpolate = d3.interpolateString(fromD, toD);
  const proxy = { t: 0 };
  tl.to(proxy, {
    t: 1, duration: 1.4, ease: "power2.inOut", ...vars(opts),
    onUpdate() { path.attr("d", interpolate(proxy.t)); },
  }, where(position, opts));
};

/* Dead air, as a step rather than as a method - for a pause in the middle of
   a group, where .settle() can't reach. */
export const wait = (duration) => (tl, position) => tl.to({}, { duration: secs(duration) }, position);
