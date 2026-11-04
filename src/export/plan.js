/* What to film, and when.

   A scene is a timeline with holds in it, and a hold is a thing a video
   can't have: the playhead parks there until a presenter says the next
   sentence, and nobody says it on a recording. So the export turns each
   hold into a fixed still - `hold` seconds of the same frame - and the
   deck's running order survives into the file. Drop them instead and every
   scene cuts the moment it lands, which reads as a glitch rather than as
   pacing.

   The plan is just a list of times. The recorder seeks to each one and
   takes a picture, the encoder writes them out at a fixed rate, and the
   two halves never have to agree on anything but this array. Consecutive
   duplicates are deliberate and the recorder reuses the previous frame
   for them, so a four-second hold costs one screenshot. */

const EPS = 1e-6;

/* The times to render for one scene, in order, at `fps` frames a second.

   Always starts at 0 and ends at the scene's duration, so a scene that
   isn't a whole number of frames long still gets its last frame.

   `speed` is how fast the scene runs in the file, and it's a property of
   the recording rather than of the scene: the same choreography that
   lands in a talk is often too slow for a gif in a README and too quick
   for a scene somebody is going to pause on. It moves the sampling, not
   the timeline - 2x takes every other frame's worth of timeline per
   output frame - so the file still plays at `fps` and the easing is the
   easing that was composed.

   It deliberately doesn't touch `hold`. A beat is a thing the viewer
   reads, so its length belongs to the viewer's clock; speeding the
   animation up and then flashing the result past in half the time is
   two changes where one was asked for.

   `tail` is the same still, at the end, and it's a separate number
   because the last frame of a scene is a different thing to the beats
   inside it. A gif loops, so the finished picture is the only part a
   reader is ever going to study, and it's the part that gets a quarter
   of a second before the thing restarts from an empty stage. `--hold 0
   --tail 2` is the shape of a README gif: play it through, then let
   somebody look at it. */
export function framePlan({
  duration, stops = [], fps = 30, hold = 1.5, speed = 1, tail = 0,
}) {
  if (!(fps > 0)) throw new Error("framePlan: fps must be positive");
  if (!(speed > 0)) throw new Error("framePlan: speed must be positive");

  const length = Math.max(0, duration);
  const holdFrames = Math.max(0, Math.round(Math.max(0, hold) * fps));
  const tailFrames = Math.max(0, Math.round(Math.max(0, tail) * fps));
  const parks = [...stops]
    .filter((s) => Number.isFinite(s) && s >= 0 && s <= length + EPS)
    .sort((a, b) => a - b);

  const times = [];

  /* Both of these multiply before they divide, and that isn't style.

     A frame's time is `frame * speed / fps`: at 10fps frame 6 is exactly
     0.6, where `frame * (speed / fps)` is 0.6000000000000001 and misses
     a hold recorded at 0.6 by a float. The frame count is the same
     trick - `0.95 / (1 / 10)` is 9.499999999999998, which rounds down
     and loses the last frame of the scene. */
  const total = Math.max(1, Math.round((length * fps) / speed));
  let next = 0;

  for (let frame = 0; frame <= total; frame++) {
    const t = Math.min((frame * speed) / fps, length);

    /* Holds land before the frame that passes them, not after: the park
       is the end of the move that led up to it, so the still has to be of
       the finished move rather than of the next one already starting. */
    while (next < parks.length && parks[next] <= t + EPS) {
      const park = parks[next++];
      for (let k = 0; k < holdFrames; k++) times.push(park);
    }

    times.push(t);
  }

  /* The scene's own last frame is already the last thing in the sweep,
     so the tail is extra copies of it rather than a frame in its own
     right - which is also why `--tail 0` leaves the plan exactly as it
     was rather than taking something away. */
  for (let k = 0; k < tailFrames; k++) times.push(length);

  return times;
}

/* Every scene's plan, and the running total, for one file per scene. */
export function scenePlans(scenes, opts) {
  return scenes.map((scene) => ({ scene, times: framePlan({ ...opts, ...scene }) }));
}

/* One plan for the whole deck, scene by scene in deck order.

   Entries carry the scene they belong to, because the recorder has to
   bring that scene up before it can seek inside it. */
export function deckPlan(scenes, opts) {
  return scenePlans(scenes, opts).flatMap(({ scene, times }) =>
    times.map((time) => ({ index: scene.index, time })),
  );
}

/* How long the file runs, in seconds.

   Counted in frames rather than in timeline seconds, because the holds
   are in the file and aren't in the timeline: a scene of eleven seconds
   with six beats comes out closer to twenty. */
export const runtime = (frames, fps) => (Array.isArray(frames) ? frames.length : frames) / fps;
