/* Synthetic numbers, so the gallery is about the components rather than
   about anybody's data. */

import * as d3 from "d3";

const wave = (n, phase, amp, base) =>
  d3.range(n).map((i) => base + amp * Math.sin((i / n) * Math.PI * 2 + phase)
                       + amp * 0.25 * Math.sin((i / n) * Math.PI * 7 + phase));

export const HOURS = d3.range(0, 25);

export const REGIONS = [
  { name: "eu_west", label: "eu-west-1", slot: 0, values: wave(25, 0.4, 320, 900) },
  { name: "us_east", label: "us-east-1", slot: 1, values: wave(25, 2.6, 480, 1400) },
  { name: "ap_south", label: "ap-south-1", slot: 4, values: wave(25, 4.9, 260, 700) },
];

export const points = (s) => HOURS.map((x, i) => [x, s.values[i]]);

/* A one-colour SVG as a data URI, to prove that a glyph can be an image
   rather than a path - the case where somebody hands you a PNG logo and no
   vector of it. */
export const BADGE_IMAGE = {
  href:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
         <circle cx="24" cy="24" r="21" fill="none" stroke="#9bf6ff" stroke-width="4"/>
         <path d="M15 24h18M24 15v18" stroke="#9bf6ff" stroke-width="4"/>
       </svg>`,
    ),
};
