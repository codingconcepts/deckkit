import { setTheme, createDeck } from "deckkit";

import g0 from "./scenes/g0-chart.js";
import g1 from "./scenes/g1-cluster.js";
import g2 from "./scenes/g2-flow.js";

// No overrides: the gallery wears the default safe8 ramp, which is the one
// a new deck gets.
setTheme();

createDeck({ scenes: [g0, g1, g2] });
