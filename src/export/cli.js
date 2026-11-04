/* `deckkit export` - the deck as a file somebody can watch.

   A deck is a web page, which is the right shape for a talk and the
   wrong shape for everything that happens afterwards: a conference wants
   an mp4, a README wants a gif, and a pull request wants one scene
   rather than seven. This is the one command that covers the three. */

import { record, list } from "./record.js";
import { QUALITY, PRESETS, DITHERS } from "./encode.js";

const USAGE = `
deckkit export - record a deck as mp4 or gif

  deckkit export --dir examples/sizing/dist
  deckkit export --url http://localhost:5173/examples/sizing/ --split
  deckkit export --dir dist --scene Verdict --format gif --quality best
  deckkit export --dir dist --scene Intro --scene Verdict --speed 1.5
  deckkit export --dir dist --scene 4 --format gif --hold 0 --tail 2

Source (one is required)
  --url <url>        a deck already being served - a dev server, usually
  --dir <dir>        a built deck; served on loopback for the recording

What comes out
  --out <dir>        where the files go                  (default: export)
  --name <name>      basename for the combined file      (default: deck)
  --format <list>    mp4, gif, or mp4,gif                (default: mp4)
  --split            one file per scene, instead of one file
  --scene <id|n>     one scene, by id or 1-based position; repeatable,
                     and comma lists work. Several make one file in the
                     order given, unless --split
  --list             print the deck's scenes and stop

How it's filmed
  --fps <n>          frames a second                     (default: 30)
  --hold <secs>      how long to sit on each beat        (default: 1.5)
  --tail <secs>      how long to sit on the last frame   (default: 0)
  --speed <n>        how fast a scene runs               (default: 1)
  --width <px>       frame width      (default: the deck's own stage width)
  --height <px>      frame height
  --scale <n>        device pixel ratio; 2 renders retina (default: 1)

  --speed, --hold and --tail also take per-scene values, repeatable and
  comma-separated: --speed 1.5 --speed Verdict=0.75 --hold Intro=3

  --hold 0 --tail 2 is the shape of a looping gif: play it through,
  then let somebody look at the finished picture.

Quality
  --quality <name>   ${Object.keys(QUALITY).join(" | ")}                (default: good)
  --crf <n>          h.264 quality, lower is better        (good: 18)
  --preset <name>    x264 effort, slower is smaller        (good: slow)
  --supersample <n>  render n x and scale down; crisper    (best: 2)
  --gif-fps <n>      gif frame rate                        (good: 15)
  --gif-width <px>   gif width, height follows             (good: 960)
  --gif-colors <n>   palette size, 2-256                   (good: 256)
  --gif-dither <n>   ${DITHERS.join(" | ")}      (default: bayer)

  A preset is a starting point: anything said explicitly wins over it.

Needs ffmpeg on PATH and Chrome installed (CHROME_PATH overrides).
`;

export function parse(argv) {
  const opts = { formats: ["mp4"] };
  const number = (key, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`export: ${key} wants a number, got "${value}"`);
    return n;
  };

  const within = (key, value, low, high) => {
    const n = number(key, value);
    if (n < low || n > high) throw new Error(`export: ${key} wants ${low} to ${high}, got ${n}`);
    return n;
  };

  const oneOf = (key, value, allowed) => {
    if (!allowed.includes(value)) {
      throw new Error(`export: ${key} wants one of ${allowed.join(", ")}, got "${value}"`);
    }
    return value;
  };

  /* A number for every scene, or a number for one of them.

     Written the way a cut is described out loud - "one and a half, but
     give the verdict its own pace" - which is `--speed 1.5 --speed
     Verdict=0.75`. Bare values set the default; `id=value` sets one
     scene. Repeatable, and comma lists do the same thing on one flag. */
  const perScene = (key, raw, into) => {
    const current = typeof into === "object" && into !== null ? into : {};
    const floor = key === "--speed" ? 0.01 : 0;
    const take = (text) => within(key, text, floor, 600);

    for (const part of raw.split(",")) {
      const text = part.trim();
      if (!text) continue;
      const split = text.lastIndexOf("=");
      if (split === -1) current.default = take(text);
      else current[text.slice(0, split).trim()] = take(text.slice(split + 1));
    }
    return current;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`export: ${arg} wants a value`);
      return v;
    };

    if (!arg.startsWith("-")) throw new Error(`export: unexpected argument "${arg}"`);

    switch (arg) {
      case "--help": case "-h": opts.help = true; break;
      case "--list": opts.list = true; break;
      case "--split": opts.split = true; break;
      case "--url": opts.url = value(); break;
      case "--dir": opts.dir = value(); break;
      case "--out": opts.out = value(); break;
      case "--name": opts.name = value(); break;
      case "--scene": (opts.scene ??= []).push(value()); break;
      case "--fps": opts.fps = within(arg, value(), 1, 120); break;
      case "--hold": opts.hold = perScene(arg, value(), opts.hold); break;
      case "--tail": opts.tail = perScene(arg, value(), opts.tail); break;
      case "--speed": opts.speed = perScene(arg, value(), opts.speed); break;
      case "--width": opts.width = within(arg, value(), 16, 7680); break;
      case "--height": opts.height = within(arg, value(), 16, 4320); break;
      case "--scale": opts.scale = within(arg, value(), 0.25, 4); break;
      case "--supersample": opts.supersample = within(arg, value(), 1, 4); break;
      case "--crf": opts.crf = within(arg, value(), 0, 51); break;
      case "--preset": opts.preset = oneOf(arg, value(), PRESETS); break;
      case "--quality": opts.quality = oneOf(arg, value(), Object.keys(QUALITY)); break;
      case "--gif-fps": opts.gifFps = within(arg, value(), 1, 50); break;
      case "--gif-width": opts.gifWidth = within(arg, value(), 16, 3840); break;
      case "--gif-colors": opts.gifColors = within(arg, value(), 2, 256); break;
      case "--gif-dither": opts.gifDither = oneOf(arg, value(), DITHERS); break;
      case "--format": {
        const formats = value().split(",").map((f) => f.trim().toLowerCase()).filter(Boolean);
        const bad = formats.find((f) => f !== "mp4" && f !== "gif");
        if (bad) throw new Error(`export: unknown format "${bad}" - mp4 or gif`);
        opts.formats = [...new Set(formats)];
        break;
      }
      default:
        throw new Error(`export: unknown option "${arg}"`);
    }
  }

  return opts;
}

const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
};

/* Progress on one line, rewritten in place.

   A deck is a few thousand screenshots and the whole thing takes
   minutes, so saying nothing isn't an option; saying it on a new line
   each time buries the warnings that matter in four thousand lines of
   percentages. Only when there's a terminal there to rewrite. */
function reporter() {
  const tty = process.stderr.isTTY;
  let last = 0;
  return ({ done, total, scene }) => {
    if (!tty) return;
    const now = Date.now();
    if (now - last < 80 && done < total) return;
    last = now;
    const pct = Math.round((done / total) * 100);
    process.stderr.write(`\r  ${String(pct).padStart(3)}%  ${done}/${total}  ${scene}`.padEnd(70));
    if (done === total) process.stderr.write("\n");
  };
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parse(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  if (opts.help || (!opts.url && !opts.dir && !argv.length)) {
    process.stdout.write(`${USAGE}\n`);
    return opts.help ? 0 : 1;
  }

  try {
    if (opts.list) {
      const scenes = await list(opts);
      for (const s of scenes) {
        const beats = s.stops.length + 1;
        process.stdout.write(
          `${String(s.index + 1).padStart(2)}  ${s.id.padEnd(16)}  ` +
            `${s.duration.toFixed(1)}s  ${beats} beat${beats === 1 ? "" : "s"}  ${s.label}\n`,
        );
      }
      return 0;
    }

    const files = [];
    await record({
      ...opts,
      onProgress: reporter(),
      onFile: (file, seconds) => files.push([file, seconds]),
    });

    for (const [file, seconds] of files) process.stdout.write(`${file}  ${clock(seconds)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`\n${error.message}\n`);
    return 1;
  }
}
