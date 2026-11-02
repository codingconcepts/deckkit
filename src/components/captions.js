/* The line under the picture, and the next line after that.

   Almost every scene has one caption slot that several sentences pass
   through: say a thing, show it, replace the sentence, show the next thing.
   Written by hand that's three texts drawn at the same y with
   `opacity: 0`, and then an exit() of whichever one is currently up paired
   with a reveal() of the next - and the pairing is manual, so the scene
   that forgets one ends up with two sentences stacked on top of each other
   for the rest of the slide.

   A slot tracks what is showing. `say(i)` is a step: it takes down whatever
   is up and brings up the one you asked for, and because scenes are built
   in running order, "whatever is up" is known at build time. */

import { W, body } from "../core/stage.js";
import { SLOT } from "../core/layout.js";
import { mark } from "../anim/scene.js";
import { exit, reveal } from "../anim/steps.js";

export function captions(parent, items, opts = {}) {
  const {
    y = SLOT.caption, x = W / 2, size = 26, anchor = "middle",
    fill = "ink", lead = 0.4,
  } = opts;

  const texts = items.map((item) => {
    const spec = typeof item === "string" ? { text: item } : item;
    return body(parent, spec.text, spec.size ?? size,
                spec.status ? { status: spec.status } : (spec.fill ?? fill),
                { x: spec.x ?? x, y: spec.y ?? y, anchor, opacity: 0 });
  });

  let showing = -1;

  /* Swap to caption i. A cross-fade rather than a gap: the old sentence
     leaving and the new one arriving are the same event, and a beat of
     empty slot between them reads as a mistake. */
  const say = (i, o = {}) => (tl, position) => {
    const label = mark(tl, position);
    if (showing >= 0 && showing !== i) exit(texts[showing], { duration: lead })(tl, label);
    if (i >= 0) reveal(texts[i], { from: "below", duration: 0.7, ...o })(tl, label);
    showing = i;
  };

  say.clear = (o = {}) => (tl, position) => {
    if (showing < 0) return;
    exit(texts[showing], { duration: lead, ...o })(tl, position);
    showing = -1;
  };

  say.texts = texts;
  say.at = (i) => texts[i];
  return say;
}
