/* The export has one piece with no visual tell: the frame plan.

   Everything else about a recording you check by watching it. A plan
   that's a frame short, or that sits on a hold the audience never sees,
   produces a file that plays, looks plausible, and is out of step with
   the deck it was made from - so the arithmetic gets assertions and the
   screenshots don't. */

import test from "node:test";
import assert from "node:assert/strict";

import { framePlan, deckPlan, runtime } from "../src/export/plan.js";
import { pickScene, pickScenes, perScene, slug } from "../src/export/record.js";
import { parse } from "../src/export/cli.js";

const counts = (times) => {
  const map = new Map();
  for (const t of times) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
};

test("framePlan: a scene with no holds is a straight sweep", () => {
  const times = framePlan({ duration: 1, stops: [], fps: 10 });
  assert.deepEqual(
    times.map((t) => Number(t.toFixed(2))),
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  );
});

test("framePlan: the last frame is the end of the scene", () => {
  // 0.95s at 10fps is not a whole number of frames; the end still lands.
  const times = framePlan({ duration: 0.95, stops: [], fps: 10 });
  assert.equal(times.at(-1), 0.95);
  assert.equal(times[0], 0);
});

test("framePlan: a hold becomes that many still frames", () => {
  const times = framePlan({ duration: 1, stops: [0.5], fps: 10, hold: 2 });
  assert.equal(counts(times).get(0.5), 21); // 20 held + the frame itself
  assert.equal(times.length, 11 + 20);
});

test("framePlan: hold 0 keeps the beats but spends no time on them", () => {
  const times = framePlan({ duration: 1, stops: [0.3, 0.6], fps: 10, hold: 0 });
  assert.equal(times.length, 11);
});

test("framePlan: a hold at zero opens on the still", () => {
  const times = framePlan({ duration: 1, stops: [0], fps: 10, hold: 1 });
  assert.equal(times[0], 0);
  assert.equal(counts(times).get(0), 11);
});

test("framePlan: holds land before the frame that passes them", () => {
  // The park is the end of the move that led up to it, so the still has
  // to be of the finished move - not of the next one already starting.
  const times = framePlan({ duration: 1, stops: [0.45], fps: 10, hold: 0.2 });
  const first = times.indexOf(0.45);
  assert.equal(Number(times[first - 1].toFixed(2)), 0.4);
  assert.equal(Number(times[first + 2].toFixed(2)), 0.5);
});

test("framePlan: stops are sorted, and ones past the end are ignored", () => {
  const times = framePlan({ duration: 1, stops: [0.6, 0.2, 9], fps: 10, hold: 0.1 });
  assert.equal(counts(times).get(0.2), 2);
  assert.equal(counts(times).get(0.6), 2);
  assert.equal(times.indexOf(0.2) < times.indexOf(0.6), true);
  assert.equal(times.includes(9), false);
});

test("framePlan: fps has to be a rate", () => {
  assert.throws(() => framePlan({ duration: 1, fps: 0 }), /fps/);
});

test("deckPlan: scenes run in order, each frame knowing its scene", () => {
  const scenes = [
    { index: 0, duration: 0.2, stops: [] },
    { index: 1, duration: 0.2, stops: [] },
  ];
  const plan = deckPlan(scenes, { fps: 10, hold: 0 });
  assert.equal(plan.length, 6);
  assert.deepEqual(
    plan.map((f) => f.index),
    [0, 0, 0, 1, 1, 1],
  );
  assert.equal(plan[3].time, 0); // the second scene starts from the top
});

test("runtime: the file is longer than the timeline, by the holds", () => {
  const times = framePlan({ duration: 10, stops: [5], fps: 30, hold: 1.5 });
  assert.equal(runtime(times, 30), (301 + 45) / 30);
  assert.equal(runtime(60, 30), 2);
});

test("framePlan: a tail is more of the last frame, and nothing else", () => {
  const plain = framePlan({ duration: 1, stops: [], fps: 10 });
  const tailed = framePlan({ duration: 1, stops: [], fps: 10, tail: 2 });
  assert.deepEqual(tailed.slice(0, plain.length), plain);
  assert.equal(tailed.length, plain.length + 20);
  assert.equal(counts(tailed).get(1), 21); // the scene's own last frame, plus 20
});

test("framePlan: a tail without holds is the looping-gif shape", () => {
  const times = framePlan({ duration: 1, stops: [0.3, 0.6], fps: 10, hold: 0, tail: 1 });
  assert.equal(times.length, 11 + 10);
  assert.equal(counts(times).get(0.3), 1); // played straight through
  assert.equal(counts(times).get(1), 11); // and then parked on the end
});

test("framePlan: no tail leaves the plan exactly as it was", () => {
  assert.deepEqual(
    framePlan({ duration: 1, stops: [0.5], fps: 10, tail: 0 }),
    framePlan({ duration: 1, stops: [0.5], fps: 10 }),
  );
});

test("framePlan: the tail is in the viewer's seconds, not the scene's", () => {
  const fast = framePlan({ duration: 1, stops: [], fps: 10, speed: 2, tail: 1 });
  assert.equal(counts(fast).get(1), 11);
});

test("framePlan: speed moves the sampling, not the timeline", () => {
  const times = framePlan({ duration: 1, stops: [], fps: 10, speed: 2 });
  assert.deepEqual(
    times.map((t) => Number(t.toFixed(2))),
    [0, 0.2, 0.4, 0.6, 0.8, 1],
  );
});

test("framePlan: half speed takes twice the frames to cover the scene", () => {
  const times = framePlan({ duration: 1, stops: [], fps: 10, speed: 0.5 });
  assert.equal(times.length, 21);
  assert.equal(times.at(-1), 1);
});

test("framePlan: speed leaves the holds alone", () => {
  // A beat is a thing the viewer reads, so its length is in the
  // viewer's seconds whatever the animation is doing. 0.55 is off both
  // sweeps, so what's counted here is the hold and nothing else.
  const fast = framePlan({ duration: 1, stops: [0.55], fps: 10, hold: 1, speed: 2 });
  const slow = framePlan({ duration: 1, stops: [0.55], fps: 10, hold: 1, speed: 1 });
  assert.equal(counts(fast).get(0.55), 10);
  assert.equal(counts(slow).get(0.55), 10);
  // ...and the animation around it is half the frames at twice the speed.
  assert.equal(fast.length, 6 + 10);
  assert.equal(slow.length, 11 + 10);
});

test("framePlan: speed has to be a rate", () => {
  assert.throws(() => framePlan({ duration: 1, speed: 0 }), /speed/);
  assert.throws(() => framePlan({ duration: 1, speed: -1 }), /speed/);
});

test("perScene: a number applies to the lot", () => {
  assert.equal(perScene(2, { id: "Intro", index: 0 }, 1), 2);
});

test("perScene: a map picks by id or by position, and falls back", () => {
  const spec = { default: 1, Verdict: 0.5, 3: 2 };
  assert.equal(perScene(spec, { id: "verdict", index: 4 }, 9), 0.5);
  assert.equal(perScene(spec, { id: "Nodes", index: 2 }, 9), 2);
  assert.equal(perScene(spec, { id: "Intro", index: 0 }, 9), 1);
  assert.equal(perScene({ Verdict: 3 }, { id: "Intro", index: 0 }, 9), 9);
  assert.equal(perScene(undefined, { id: "Intro", index: 0 }, 9), 9);
});

test("pickScenes: several, in the order they were asked for", () => {
  const scenes = [{ id: "Intro" }, { id: "Middle" }, { id: "Verdict" }];
  assert.deepEqual(
    pickScenes(scenes, ["Verdict", "Intro"]).map((s) => s.id),
    ["Verdict", "Intro"],
  );
  assert.deepEqual(
    pickScenes(scenes, ["3,1"]).map((s) => s.id),
    ["Verdict", "Intro"],
  );
  assert.deepEqual(pickScenes(scenes, "Middle").map((s) => s.id), ["Middle"]);
});

test("pickScene: by id, case-insensitively", () => {
  const scenes = [{ id: "Intro" }, { id: "Verdict" }];
  assert.equal(pickScene(scenes, "verdict").id, "Verdict");
  assert.equal(pickScene(scenes, "Intro").id, "Intro");
});

test("pickScene: by position, one-based, like the HUD", () => {
  const scenes = [{ id: "Intro" }, { id: "Verdict" }];
  assert.equal(pickScene(scenes, 2).id, "Verdict");
  assert.equal(pickScene(scenes, "1").id, "Intro");
});

test("pickScene: an id that looks like a number is still an id", () => {
  const scenes = [{ id: "Intro" }, { id: "1" }];
  assert.equal(pickScene(scenes, "1").id, "1");
});

test("pickScene: an unknown scene names the ones there are", () => {
  assert.throws(() => pickScene([{ id: "Intro" }], "Nope"), /Intro/);
  assert.throws(() => pickScene([{ id: "Intro" }], 7), /no scene/);
});

test("slug: a filename, from an id written for a human", () => {
  assert.equal(slug("S1 Workloads"), "s1-workloads");
  assert.equal(slug("Peak of the sum!"), "peak-of-the-sum");
  assert.equal(slug("  "), "scene");
});

test("slug: the capitals are the word boundaries", () => {
  // An export should land next to the scene file it came from, under
  // the same name: s2-peaks-in-time.js -> s2-peaks-in-time.mp4.
  assert.equal(slug("S0Title"), "s0-title");
  assert.equal(slug("S2PeaksInTime"), "s2-peaks-in-time");
  assert.equal(slug("S3PeakOfSum"), "s3-peak-of-sum");
  assert.equal(slug("CPUUsage"), "cpu-usage");
  assert.equal(slug("already-hyphenated"), "already-hyphenated");
});

test("parse: the defaults are a deck as one mp4", () => {
  const opts = parse(["--dir", "dist"]);
  assert.deepEqual(opts.formats, ["mp4"]);
  assert.equal(opts.dir, "dist");
  assert.equal(opts.split, undefined);
  assert.equal(opts.scene, undefined);
});

test("parse: the modes", () => {
  assert.equal(parse(["--split"]).split, true);
  assert.deepEqual(parse(["--scene", "Verdict"]).scene, ["Verdict"]);
  assert.deepEqual(parse(["--scene", "3"]).scene, ["3"]);
});

test("parse: --scene repeats, and keeps the order it was given in", () => {
  assert.deepEqual(parse(["--scene", "Verdict", "--scene", "Intro"]).scene, ["Verdict", "Intro"]);
  assert.deepEqual(parse(["--scene", "a,b"]).scene, ["a,b"]);
});

test("parse: speed and hold are a number, or a number per scene", () => {
  assert.deepEqual(parse(["--speed", "1.5"]).speed, { default: 1.5 });
  assert.deepEqual(parse(["--speed", "1.5", "--speed", "Verdict=0.75"]).speed, {
    default: 1.5,
    Verdict: 0.75,
  });
  assert.deepEqual(parse(["--hold", "Intro=3,2"]).hold, { Intro: 3, default: 2 });
  assert.deepEqual(parse(["--tail", "2", "--tail", "Intro=0"]).tail, { default: 2, Intro: 0 });
  assert.throws(() => parse(["--speed", "0"]), /--speed/);
  assert.throws(() => parse(["--speed", "Intro=fast"]), /number/);
});

test("parse: quality is a name, and the knobs under it are checked", () => {
  assert.equal(parse(["--quality", "best"]).quality, "best");
  assert.equal(parse(["--gif-dither", "fine"]).gifDither, "fine");
  assert.equal(parse(["--preset", "veryslow"]).preset, "veryslow");
  assert.throws(() => parse(["--quality", "ultra"]), /draft, good, best/);
  assert.throws(() => parse(["--preset", "turbo"]), /--preset/);
  assert.throws(() => parse(["--gif-dither", "swirl"]), /--gif-dither/);
  assert.throws(() => parse(["--gif-colors", "900"]), /2 to 256/);
  assert.throws(() => parse(["--crf", "99"]), /0 to 51/);
  assert.throws(() => parse(["--supersample", "8"]), /1 to 4/);
});

test("parse: formats are a list, de-duplicated", () => {
  assert.deepEqual(parse(["--format", "gif,mp4"]).formats, ["gif", "mp4"]);
  assert.deepEqual(parse(["--format", "mp4,mp4"]).formats, ["mp4"]);
  assert.throws(() => parse(["--format", "webm"]), /webm/);
});

test("parse: numbers are numbers, and rubbish is caught here", () => {
  assert.equal(parse(["--fps", "60"]).fps, 60);
  assert.equal(parse(["--scale", "2"]).scale, 2);
  assert.throws(() => parse(["--fps", "soon"]), /number/);
  assert.throws(() => parse(["--fps"]), /wants a value/);
  assert.throws(() => parse(["--colour", "red"]), /unknown option/);
  assert.throws(() => parse(["dist"]), /unexpected argument/);
});
