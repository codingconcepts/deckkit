/* Readings: the marks that show one number moving.

   Both return {state, render}, which is the shape drive() moves - so a
   scene never holds the proxy object itself or has to remember which of
   the two arguments is the one that redraws. */

import { el, svgText } from "../core/stage.js";
import { THEME, paint } from "../core/theme.js";
import { compact, percent } from "../core/format.js";

/* A horizontal gauge: a track, a bar, and the figure that reads it.

   Everything is driven off one proxy - the GSAP equivalent of Manim's
   ValueTracker - so the bar's width, the bar's fill and the percentage all
   come from the same number and can't disagree halfway through a sweep.
   That's also what lets the fill change its mind at a threshold without a
   second tween to coordinate with.

   `colour` and `textColour` are functions of the value rather than colours,
   because a gauge that means something different when it's full has to be
   able to say so. `ceiling` draws the end of the budget, if the track's
   right-hand edge is a limit rather than just the end of the track. */
export function meter(parent, opts) {
  const {
    cx, y, width, height = 15, size = 28,
    colour = () => THEME.good, textColour = () => THEME.ink,
    textY = y + height + 30, ceiling,
    format = percent,
  } = opts;
  const left = cx - width / 2;
  const g = parent.append("g");

  el(g, "rect", { x: left, y, width, height, fill: THEME.grid });
  const bar = el(g, "rect", { x: left, y, width: 0.001, height, fill: THEME.muted });
  if (ceiling) {
    el(g, "line", {
      x1: left + width, x2: left + width, y1: y, y2: y + height,
      stroke: paint(ceiling, THEME.critical), "stroke-width": THEME.hairline + 0.6,
    });
  }
  const readout = svgText(g, "", { size, fill: "ink", x: cx, y: textY, anchor: "middle" });

  const state = { value: 0 };
  const render = () => {
    // Never exactly zero: a rect of width 0 isn't rendered at all, and the
    // bar should still be there when it's empty.
    bar.attr("width", Math.max(width * Math.min(state.value, 1), 0.001))
       .attr("fill", colour(state.value));
    readout.text(format(state.value)).attr("fill", textColour(state.value));
  };
  render();
  return { g, bar, readout, state, render };
}

/* A figure that counts to its value.

   Drawn at zero and hidden: a counter reading "0" for three beats before
   anything moves reads as a measurement rather than as a placeholder, so
   the default is that it isn't there until its beat brings it in. */
export function counter(parent, opts = {}) {
  const { format = compact, size = 28, fill = "ink", hidden = true, ...rest } = opts;
  const text = svgText(parent, format(0), { size, fill, opacity: hidden ? 0 : 1, ...rest });
  const state = { value: 0 };
  return { text, g: text, state, render: () => text.text(format(state.value)) };
}

/* A reading's colour, as a function of how hard the thing is working.

   Curried on the resting colour, because a meter's bar and the figure under
   it recede to different inks but have to change their minds at the same
   threshold - two calls to the same curried function can't drift, two
   separate conditionals can. */
export const heat = (resting, { pressure = 0.7, absent = 0.005 } = {}) => (value) => {
  if (value < absent) return THEME.muted;   // something switched off should recede
  return value > pressure ? THEME.warn : paint(resting, THEME.good);
};
