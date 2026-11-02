/* Does this palette actually work?

   The library claims its ramps are "validated against a dark chart
   surface". This is the thing that makes that a fact rather than a habit.
   Five checks, and every one of them is a way a categorical palette fails
   on a projector:

     lightness band   steps too far apart in lightness read as a sequence,
                      so the eye infers an order the data hasn't got
     chroma floor     a step with no chroma left is grey, and grey is what
                      "no data" looks like
     CVD separation   adjacent slots must stay apart under protanopia,
                      deuteranopia and tritanopia - adjacent, because slot
                      order is also stack order
     normal floor     and apart for everyone else too
     contrast         every step has to be visible on the surface it sits on

   Run with `npm run palette`. Exits non-zero on a failure, so it can sit in
   CI next to the tests.

   Colour-vision simulation is Viénot, Brettel & Mollon (1999) - the LMS
   projection, not a hue rotation. dE is Euclidean distance in OKLab times
   100, which is close enough to CIEDE2000 at these separations and far
   easier to read. */

import { PALETTES, THEME_DEFAULTS } from "../src/core/theme.js";

// ---------------------------------------------------------------- colour

const hex = (s) => {
  const n = parseInt(s.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (rgb) => rgb.map(toLinear);

/* OKLab, for perceptual distance and for a lightness figure that means
   something. */
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const chromaOf = ([, a, b]) => Math.hypot(a, b);
const deltaE = (p, q) => 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/* Relative luminance, for the WCAG contrast ratio. */
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---- Viénot, Brettel & Mollon (1999) dichromat simulation ---------------

const RGB_TO_LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
];
const LMS_TO_RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
];

const apply = (m, v) => m.map((row) => row.reduce((sum, k, i) => sum + k * v[i], 0));

const DICHROMATS = {
  protan: ([l, m, s]) => [1.05118294 * m - 0.05116099 * s, m, s],
  deutan: ([l, m, s]) => [l, 0.9513092 * l + 0.04866992 * s, s],
  tritan: ([l, m, s]) => [l, m, -0.86744736 * l + 1.86727089 * m],
};

const simulate = (rgbLinear, kind) =>
  apply(LMS_TO_RGB, DICHROMATS[kind](apply(RGB_TO_LMS, rgbLinear)))
    .map((v) => Math.min(1, Math.max(0, v)));

// ---------------------------------------------------------------- checks

const LIMITS = {
  lightnessBand: 0.22,  // max spread in OKLab L across the ramp
  chromaFloor: 0.045,
  adjacentCVD: 8,       // dE between neighbouring slots, worst dichromat
  adjacentNormal: 12,
  contrast: 3,          // against the chart surface
};

/* Palettes that are shipped knowing they fail, and why.

   An exception rather than a lowered threshold. Tuning the limits until
   everything passes would make this script theatre; listing the one ramp
   that doesn't, with the measurement, keeps the failure visible on every
   run without turning CI permanently red. */
const KNOWN_WEAK = {
  pastel8:
    "house look, kept for decks already using it - slots 5/6 are dE 1.0 apart " +
    "under deuteranopia. Not the default.",
};

function validate(name, ramp, surface) {
  const linears = ramp.map((c) => linear(hex(c)));
  const labs = linears.map(oklab);
  const surfaceRGB = linear(hex(surface));
  const failures = [];

  const lightness = labs.map((l) => l[0]);
  const band = Math.max(...lightness) - Math.min(...lightness);
  if (band > LIMITS.lightnessBand) {
    failures.push(`lightness spread ${band.toFixed(3)} > ${LIMITS.lightnessBand}`);
  }

  ramp.forEach((colour, i) => {
    const c = chromaOf(labs[i]);
    if (c < LIMITS.chromaFloor) {
      failures.push(`slot ${i} ${colour}: chroma ${c.toFixed(3)} < ${LIMITS.chromaFloor}`);
    }
    const ratio = contrast(linears[i], surfaceRGB);
    if (ratio < LIMITS.contrast) {
      failures.push(`slot ${i} ${colour}: contrast ${ratio.toFixed(2)}:1 on surface`);
    }
  });

  let worst = { dE: Infinity, kind: null, pair: null };
  for (let i = 0; i < ramp.length - 1; i++) {
    const normal = deltaE(labs[i], labs[i + 1]);
    if (normal < LIMITS.adjacentNormal) {
      failures.push(`slots ${i}/${i + 1}: dE ${normal.toFixed(1)} in normal vision`);
    }
    for (const kind of Object.keys(DICHROMATS)) {
      const dE = deltaE(oklab(simulate(linears[i], kind)),
                        oklab(simulate(linears[i + 1], kind)));
      if (dE < worst.dE) worst = { dE, kind, pair: [i, i + 1] };
      if (dE < LIMITS.adjacentCVD) {
        failures.push(`slots ${i}/${i + 1}: dE ${dE.toFixed(1)} under ${kind}`);
      }
    }
  }

  const known = KNOWN_WEAK[name];
  console.log(`\n${name}  (${ramp.length} slots, surface ${surface})`);
  console.log(`  lightness band  ${band.toFixed(3)}`);
  console.log(`  worst adjacent  dE ${worst.dE.toFixed(1)} ` +
              `(${worst.kind}, slots ${worst.pair.join("<->")})`);
  if (!failures.length) {
    console.log("  pass");
    return 0;
  }
  const tag = known ? "known" : "FAIL ";
  failures.forEach((f) => console.log(`  ${tag}  ${f}`));
  if (known) console.log(`  known weakness: ${known}`);
  return known ? 0 : failures.length;
}

const surface = THEME_DEFAULTS.surface;
const failed = Object.entries(PALETTES)
  .reduce((n, [name, ramp]) => n + validate(name, ramp, surface), 0);

const waived = Object.keys(KNOWN_WEAK).length;
console.log(failed
  ? `\n${failed} failure(s)\n`
  : `\nno unexpected failures (${waived} palette(s) shipped with known weaknesses)\n`);
process.exit(failed ? 1 : 0);
