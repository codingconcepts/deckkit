/* Capture mode: the same deck, driven one frame at a time.

   A recorder can't press the arrow keys and film the result - a talk runs
   at wall-clock speed, drops frames when the laptop is busy, and parks on
   its holds for however long the presenter talks. None of that belongs in
   an mp4.

   So the export path doesn't play anything. It asks the deck for its
   scenes, then seeks a timeline to an exact time and takes a picture,
   `fps` times per second of scene. Every frame is rendered from the
   timeline's own state rather than captured as it goes past, which is why
   the output is identical on a fast machine and a slow one.

   Seeking - rather than playing - is only safe because nothing in the
   library draws from a clock: every value on screen is a function of
   timeline position, including the ones drawn by onUpdate (morphs,
   counters, meters, split-flaps). Those are the reason callbacks stay
   switched on here, exactly as they do for the arrow keys. */

/* The contract with the recorder, and with anything else that wants the
   deck a frame at a time. `ctx` is the deck's own internals - the slides,
   the lazy builder, and the stage they live on. */
export function createCapture(ctx) {
  const { mount, slides, ensure, width, height } = ctx;

  let active = null;

  const describe = (slide, index) => ({
    index,
    id: slide.scene.id,
    label: slide.scene.label ?? slide.scene.id,
    duration: slide.tl.duration(),
    stops: [...((slide.tl.data && slide.tl.data.stops) || [])],
  });

  const showOnly = (slide) => {
    for (const s of slides) {
      if (s.svg) s.svg.style("display", s === slide ? "block" : "none");
    }
  };

  return {
    /* Enter capture mode.

       Builds every scene up front, which is the one place the deck's lazy
       build is the wrong behaviour: the recorder needs every duration
       before it can plan a single frame, and there's no audience waiting
       on the stall.

       Speed goes back to 1x whatever the HUD says. The speed control
       exists so a presenter can slow a talk down in the room; baking that
       into a file would make the export a different edit to the deck. */
    begin() {
      mount.classList.add("capture");
      for (const slide of slides) {
        ensure(slide);
        slide.tl.timeScale(1);
        slide.tl.pause(0, false);
      }
      showOnly(null);
      active = null;
      return { width, height, scenes: slides.map(describe) };
    },

    /* The scenes and their shape: how long each runs, and where it parks.

       The stops are the interesting half. A hold is dead air the presenter
       fills, so a recording has to decide how long to sit on it - and that
       decision belongs to whoever is making the file, not here. */
    scenes() {
      for (const slide of slides) ensure(slide);
      return slides.map(describe);
    },

    /* Bring one scene up, alone, and rewound. */
    select(index) {
      const slide = slides[index];
      if (!slide) throw new Error(`capture: no scene at ${index}`);
      ensure(slide);
      showOnly(slide);
      active = slide;
      slide.tl.timeScale(1);
      slide.tl.pause(0, false);
      return describe(slide, index);
    },

    /* Render the selected scene at an exact time, callbacks and all.

       Same seek the arrow keys use: suppress the callbacks and every
       onUpdate-drawn thing on the slide keeps whatever shape it was last
       rendered at, so a morph freezes mid-curve and a counter reads zero
       for the rest of the film. */
    seek(time) {
      if (!active) throw new Error("capture: select a scene first");
      const t = Math.max(0, Math.min(active.tl.duration(), time));
      active.tl.pause(t, false);
      return t;
    },

    /* Hand the deck back to its presenter. */
    end() {
      mount.classList.remove("capture");
      active = null;
    },
  };
}
