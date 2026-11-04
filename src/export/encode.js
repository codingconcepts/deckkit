/* PNGs in, a file out.

   The frames are never written to disk. A minute of 1080p stills is a
   couple of gigabytes of intermediate files to produce a twenty megabyte
   video, and a deck that wants one still has `?slide=3&frame=end` and a
   screenshot. Every frame goes down a pipe into ffmpeg as it's taken.

   Both formats at once means both encoders at once, fed the same buffer.
   The alternative is recording the deck twice, and the screenshots are
   the slow half of the job by an order of magnitude. */

import { spawn } from "node:child_process";
import { once } from "node:events";

/* yuv420p needs even dimensions and a deck can be any size, so the crop
   is unconditional rather than conditional on the numbers - a filter that
   only sometimes runs is a filter that's only sometimes tested. */
const EVEN = "crop=trunc(iw/2)*2:trunc(ih/2)*2";

/* The three answers to "how good?", named rather than numbered.

   crf 18 and a slow preset is the right default for a deck - flat
   colour and sharp type, where the artefacts show up as fuzz around the
   letters long before they show up anywhere else - and nobody arrives
   at that by reading an x264 man page. `draft` is for checking the
   choreography, `best` is for the file that gets uploaded once.

   Every number here is also a flag, so a preset is a starting point
   rather than a ceiling. */
export const QUALITY = {
  draft: { crf: 30, preset: "veryfast", gifFps: 10, gifWidth: 640, gifColors: 64, supersample: 1 },
  good: { crf: 18, preset: "slow", gifFps: 15, gifWidth: 960, gifColors: 256, supersample: 1 },
  best: { crf: 14, preset: "slower", gifFps: 20, gifWidth: 1280, gifColors: 256, supersample: 2 },
};

/* Dithering, in the terms the picture is in rather than ffmpeg's.

   A deck is flat fills and antialiased type on a dark plane, which is
   the case error diffusion is worst at: it stipples every background it
   can't match exactly, and a stippled background is both ugly and huge,
   because nothing compresses less well than noise. `bayer` keeps the
   file small and the edges clean. `fine` is there for the deck with a
   gradient in it, and `none` for the one that's eight flat colours and
   wants to stay that way. */
const DITHER = {
  bayer: "bayer:bayer_scale=3",
  coarse: "bayer:bayer_scale=5",
  fine: "sierra2_4a",
  none: "none",
};

export const DITHERS = Object.keys(DITHER);
export const PRESETS = [
  "ultrafast", "superfast", "veryfast", "faster", "fast",
  "medium", "slow", "slower", "veryslow",
];

const H264 = ({ fps, crf, preset, size }) => [
  "-c:v", "libx264",
  "-preset", preset,
  "-crf", String(crf),
  "-pix_fmt", "yuv420p",
  "-vf", [size ? `scale=${size[0]}:${size[1]}:flags=lanczos` : null, EVEN].filter(Boolean).join(","),
  "-r", String(fps),
  "-movflags", "+faststart",
];

/* `stats_mode=diff` spends the palette on what moves rather than on the
   twelve shades of plane behind it, which is most of why a deck's gif
   looks like the deck. */
const GIF = ({ gifFps, gifWidth, gifColors, gifDither, size }) => {
  const width = gifWidth ?? size?.[0] ?? null;
  return [
    "-vf",
    [
      `fps=${gifFps}`,
      width ? `scale=${width}:-2:flags=lanczos` : null,
      "split[a][b]",
      `[a]palettegen=max_colors=${gifColors}:stats_mode=diff[p]`,
      `[b][p]paletteuse=dither=${DITHER[gifDither] ?? DITHER.bayer}`,
    ]
      .filter(Boolean)
      .join(","),
    "-loop", "0",
  ];
};

/* One ffmpeg, waiting on stdin.

   `write` resolves when the pipe is ready for more, which is the whole of
   the backpressure story: without it a long scene buffers every frame it
   has taken into memory while x264 works through them. */
export function encoder({
  file, format, fps = 30,
  crf = QUALITY.good.crf, preset = QUALITY.good.preset,
  gifFps = QUALITY.good.gifFps, gifWidth = QUALITY.good.gifWidth,
  gifColors = QUALITY.good.gifColors, gifDither = "bayer",
  size = null,
}) {
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    ...(format === "gif"
      ? GIF({ gifFps, gifWidth, gifColors, gifDither, size })
      : H264({ fps, crf, preset, size })),
    file,
  ];

  const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4000);
  });

  const failed = new Promise((_, reject) => {
    proc.on("error", (error) =>
      reject(
        error.code === "ENOENT"
          ? new Error("export: ffmpeg not found on PATH. `brew install ffmpeg`.")
          : error,
      ),
    );
  });

  return {
    file,
    format,

    async write(buffer) {
      if (proc.exitCode !== null) throw new Error(`export: ffmpeg stopped\n${stderr.trim()}`);
      if (!proc.stdin.write(buffer)) {
        await Promise.race([once(proc.stdin, "drain"), failed]);
      }
    },

    async done() {
      proc.stdin.end();
      const [code] = await Promise.race([once(proc, "close"), failed.then(() => [1])]);
      if (code !== 0) throw new Error(`export: ffmpeg failed (${code})\n${stderr.trim()}`);
      return file;
    },

    kill() {
      proc.kill();
    },
  };
}

/* Is ffmpeg there at all?

   Checked before the browser starts rather than after the last frame:
   finding out that the encoder is missing having just spent four minutes
   screenshotting a deck is the worst possible moment to find out. */
export async function requireFfmpeg() {
  const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
  const [code] = await Promise.race([
    once(proc, "close"),
    once(proc, "error").then(() => [-1]),
  ]);
  if (code !== 0) {
    throw new Error(
      "export: ffmpeg not found on PATH. Install it (`brew install ffmpeg`, " +
        "`apt install ffmpeg`) - the deck is rendered here, but it's encoded there.",
    );
  }
}
