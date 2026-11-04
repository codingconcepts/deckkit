/* A scene you can read as a running order.

   Every scene in a deck is the same shape - draw everything up front, then
   choreograph it - and the choreography is the part that repeats. Scenes
   between them say "fade this in", "draw this on", "pop this marker",
   "park here and wait" over and over, each time spelled out as a GSAP call
   with its own duration, easing and position argument. The verbs are
   already there; they just aren't named.

   So: a timeline that holds, and a vocabulary of steps to put between the
   holds. A build method ends up reading as the running order of the scene
   rather than as the GSAP needed to produce it -

     return scene()
       .step(enter(title, { from: "above" }))
       .hold()
       .step(together(draw(plot), enter(name)))
       .settle();

   A step is a function (tl, position) -> void. So a scene with a move
   nothing else makes writes it inline as a closure rather than waiting
   for the library to grow a verb for it. */

import { gsap } from "gsap";

import { at, secs } from "../core/time.js";

/* A paused timeline that records where it parks.

   `data.stops` is the contract with the deck shell: the times the playhead
   should wait at, in order, so the arrow keys can walk a scene's beats
   forwards and backwards and the HUD can count them. */
export function scene(vars = {}) {
  const tl = gsap.timeline({ paused: true, ...vars });
  tl.data = { stops: [], marks: 0 };

  return Object.assign(tl, {
    /* Park here until the presenter releases it.

       Recorded before addPause() so the time is the end of everything
       appended so far, which is where the pause actually lands. */
    hold() {
      this.data.stops.push(this.duration());
      return this.addPause();
    },

    /* Append steps, in order, each starting where the last one finished
       unless it says otherwise. */
    step(...steps) {
      steps.flat().filter(Boolean).forEach((s) => s(this));
      return this;
    },

    /* hold() then step(): the pair that makes up most of a scene, said once.
       `.beat(x)` is "wait, then do x", which is how the running order reads
       out loud. */
    beat(...steps) {
      return this.hold().step(...steps);
    },

    /* Dead air at the end of a scene, so the last move has somewhere to land
       before the deck moves on. Every scene wants one; none of them want to
       spell `.to({}, { duration })` to get it. */
    settle(duration = 1.2) {
      return this.to({}, { duration: secs(duration) });
    },
  });
}

/* A unique label at a position, for steps that need several tweens to share
   a start. The counter lives on the timeline so two scenes can't collide.

   The `dk` prefix isn't decoration: `@` is deckkit's sigil for an absolute
   position, so a label called `@1` would be read as "one second from the
   top of the scene" by the time parser. */
export function mark(tl, position) {
  const label = `dk${(tl.data.marks = (tl.data.marks || 0) + 1)}`;
  tl.addLabel(label, at(position));
  return label;
}
