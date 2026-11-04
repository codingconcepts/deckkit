/* The export: a deck, a browser, and some number of files.

   Three things get exported, and they're the same job three times over:

     the deck          every scene, in order, as one video
     every scene       one file each, same frames, cut at the boundaries
     some scenes       the ones you asked for, together or apart

   So there's one notion of a job - a list of frames and the encoders to
   feed them to - and the modes are ways of grouping scenes into jobs.
   mp4 and gif are not a fourth mode: a job can have both encoders,
   because the screenshots cost a hundred times what the encoding does
   and taking them twice to write two containers would be silly. */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { launch } from "./chrome.js";
import { encoder, requireFfmpeg, QUALITY } from "./encode.js";
import { framePlan, runtime } from "./plan.js";
import { serve } from "./serve.js";

const EXT = { mp4: "mp4", gif: "gif" };

/* A filename, from an id written for a human.

   The word boundaries in `S2PeaksInTime` are capitals, and a deck keeps
   its scenes in files called `s2-peaks-in-time.js` - so splitting on the
   capitals is what makes the export land next to the source it came
   from under the same name. The second pass is for the acronym:
   `CPUUsage` is cpu-usage, not c-p-u-usage. */
export const slug = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase() || "scene";

/* Which scene the user meant.

   An id, because that's what the scene calls itself and what the deck's
   own `?slide=` doesn't accept; or a position, one-based, because that's
   the number on the HUD. Ambiguity resolves to the id - a scene actually
   called "2" is rare, but when it exists it's what was asked for. */
export function pickScene(scenes, wanted) {
  const asked = String(wanted).trim();
  const byId = scenes.find((s) => s.id?.toLowerCase() === asked.toLowerCase());
  if (byId) return byId;

  const position = Number(asked);
  if (Number.isInteger(position) && position >= 1 && position <= scenes.length) {
    return scenes[position - 1];
  }

  throw new Error(
    `export: no scene "${wanted}". The deck has ${scenes.length}: ` +
      scenes.map((s, i) => `${i + 1} ${s.id}`).join(", "),
  );
}

/* Several of them, in the order they were asked for.

   Deck order would be the safer choice and it's the wrong one: a list
   of scenes is an edit, and an edit that silently reorders itself isn't
   one. `--scene Verdict --scene Intro` means that, in that order. */
export const pickScenes = (scenes, wanted) =>
  [wanted].flat().flatMap((w) => String(w).split(",")).map((w) => pickScene(scenes, w));

/* A setting that can differ per scene.

   `speed` and `hold` are the two the same recording wants different
   answers to in different places - the title card nobody needs four
   seconds to read, the one dense chart everybody does - so both take
   either a number for the lot or a map keyed by id or position.

     1.5                     every scene
     { default: 1, S2: 2 }   S2 at double, the rest as composed */
export function perScene(spec, scene, fallback) {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === "number") return spec;

  const keys = Object.keys(spec);
  const byId = keys.find((k) => k.toLowerCase() === String(scene.id).toLowerCase());
  if (byId) return spec[byId];

  const byPosition = keys.find((k) => Number(k) === scene.index + 1);
  if (byPosition) return spec[byPosition];

  return spec.default ?? fallback;
}

/* What's in the deck: the ids to pass to `--scene`, and how long each one
   runs. Worth its own mode because `--scene` takes a name, and the name
   is in the source of the deck rather than on the screen. */
export async function list({ url, dir }) {
  if (!url && !dir) throw new Error("export: give it --url or --dir");
  const server = dir ? await serve(dir) : null;
  let browser = null;
  try {
    browser = await launch({ width: 1280, height: 720 });
    await browser.open(url ?? server.url);
    return await browser.evaluate("window.__deckkit__.capture.scenes()");
  } finally {
    await browser?.close();
    await server?.close();
  }
}

/* Record a deck.

   `url` or `dir`: a running dev server, or a built folder this serves
   itself for the length of the job. Everything else has a default that
   suits a talk rather than a thumbnail. */
export async function record(opts = {}) {
  const {
    url, dir, out = "export", name = "deck",
    formats = ["mp4"], fps = 30, hold = 1.5, speed = 1, tail = 0,
    width, height, scale = 1,
    scene: wanted = null, split = false,
    quality = "good",
    onProgress = () => {}, onFile = () => {},
  } = opts;

  if (!url && !dir) throw new Error("export: give it --url or --dir");

  /* A named quality, then whatever was said explicitly on top of it.

     The preset has to lose every argument it's in, or `--quality draft
     --crf 14` means something other than what it says. */
  const preset = QUALITY[quality];
  if (!preset) {
    throw new Error(`export: unknown quality "${quality}" - ${Object.keys(QUALITY).join(", ")}`);
  }
  const encoding = {
    crf: opts.crf ?? preset.crf,
    preset: opts.preset ?? preset.preset,
    gifFps: opts.gifFps ?? preset.gifFps,
    gifWidth: opts.gifWidth ?? preset.gifWidth,
    gifColors: opts.gifColors ?? preset.gifColors,
    gifDither: opts.gifDither ?? "bayer",
  };
  const supersample = Math.max(1, opts.supersample ?? preset.supersample);

  await requireFfmpeg();

  const server = dir ? await serve(dir) : null;
  const target = url ?? server.url;

  let browser = null;
  const written = [];

  try {
    /* The stage's usual size, to be going on with: the deck can't be
       asked how big it is until it has loaded, and it can't load without
       a window to load into. */
    browser = await launch({ width: width ?? 1280, height: height ?? 720, scale });
    await browser.open(target);

    const deck = await browser.evaluate("window.__deckkit__.capture.begin()");

    /* Now that there's a deck to ask, film it at its own shape unless the
       caller asked for a size. 16:9 at 1280 is the stage's default, not a
       law, and a deck that overrides W and H shouldn't come out
       letterboxed. A size with one dimension given keeps the stage's
       aspect, which is what `--width 1920` is for. */
    const aspect = deck.width / deck.height;
    const w = width ?? (height ? Math.round(height * aspect) : deck.width);
    const h = height ?? (width ? Math.round(width / aspect) : deck.height);

    /* Supersampling: render bigger than the file, let ffmpeg bring it
       down. Chrome antialiases SVG perfectly well, so this isn't fixing
       jaggies - it's what keeps thin strokes and small type from going
       soft when the gif then halves the width again. It costs a frame
       four times the size to screenshot, which is why only `best` asks
       for it by default. */
    await browser.resize(w * supersample, h * supersample);
    const size = supersample > 1 ? [w, h] : null;

    const all = deck.scenes;
    const chosen = wanted !== null && wanted !== undefined ? pickScenes(all, wanted) : all;

    /* One job for the lot, or one job per scene. A list of scenes is the
       same two cases over a shorter list, which is why naming scenes
       isn't a third branch: it's an edit, and an edit is still either
       one film or several. */
    const groups = split
      ? chosen.map((s) => ({ file: slug(s.id), scenes: [s] }))
      : chosen.length === 1
        ? [{ file: slug(chosen[0].id), scenes: chosen }]
        : [{ file: name, scenes: chosen }];

    const plans = groups.map((group) => ({
      ...group,
      parts: group.scenes.map((s) => ({
        scene: s,
        times: framePlan({
          ...s,
          fps,
          hold: perScene(hold, s, 1.5),
          speed: perScene(speed, s, 1),
          tail: perScene(tail, s, 0),
        }),
      })),
    }));

    const total = plans.reduce(
      (n, p) => n + p.parts.reduce((m, part) => m + part.times.length, 0),
      0,
    );
    let done = 0;

    /* Made here rather than up front, so a run that's going to fail on
       its arguments doesn't leave an empty `export/` behind as its only
       lasting effect. */
    await mkdir(out, { recursive: true });

    for (const plan of plans) {
      const encoders = formats.map((format) =>
        encoder({ file: join(out, `${plan.file}.${EXT[format]}`), format, fps, size, ...encoding }),
      );

      try {
        for (const { scene, times } of plan.parts) {
          await browser.evaluate(`window.__deckkit__.capture.select(${scene.index})`);

          /* A hold is the same frame several hundred times over. Seeking
             to a time the playhead is already at renders nothing new, so
             the screenshot is skipped and the previous buffer written
             again - which is the difference between a four-second hold
             costing one picture and costing a hundred and twenty. */
          let last = null;
          let frame = null;
          for (const time of times) {
            if (frame === null || time !== last) {
              await browser.evaluate(`window.__deckkit__.capture.seek(${time})`);
              frame = await browser.screenshot();
              last = time;
            }
            for (const enc of encoders) await enc.write(frame);
            onProgress({ done: ++done, total, scene: scene.id });
          }
        }

        const seconds = runtime(
          plan.parts.reduce((n, p) => n + p.times.length, 0),
          fps,
        );
        for (const enc of encoders) {
          written.push(await enc.done());
          onFile(enc.file, seconds);
        }
      } catch (error) {
        for (const enc of encoders) enc.kill();
        throw error;
      }
    }

    await browser.evaluate("window.__deckkit__.capture.end()");
    return written;
  } finally {
    await browser?.close();
    await server?.close();
  }
}
