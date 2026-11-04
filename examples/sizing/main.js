/* The deck: which palette it wears, and what order the scenes run in.

   The HUD, the keyboard handling, the scrubber and the speed menu are
   the library's; the project's job is a theme and a list. */

import { setTheme, PALETTES, createDeck } from "deckkit";

import s0 from "./scenes/s0-title.js";
import s1 from "./scenes/s1-workloads.js";
import s2 from "./scenes/s2-peaks-in-time.js";
import s3 from "./scenes/s3-peak-of-sum.js";
import s4 from "./scenes/s4-verdict.js";
import s5 from "./scenes/s5-nodes.js";
import s6 from "./scenes/s6-summary.js";

setTheme({ series: PALETTES.pastel8 });

createDeck({ scenes: [s0, s1, s2, s3, s4, s5, s6] });
