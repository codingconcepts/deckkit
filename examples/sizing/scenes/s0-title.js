/* S0Title - the cold open: state the rule, before any of the evidence for it.

   Deliberately bare. The two halves of the sentence are the two columns S4
   ends on, so the wrong half is already wearing the colour it will be
   wearing when the numbers arrive. */

import { card, scene } from "deckkit";

export default {
  id: "S0Title",
  label: "The rule",

  build(svg) {
    const rule = card(svg, [
      "Size for the peak of the sum,",
      [{ text: "not the " },
       { text: "sum of the peaks", fill: { status: "critical" } },
       { text: "." }],
    ]);

    // Opens on an empty stage and waits - the leading .beat(). This is the
    // first thing the room sees, so the rule arrives when the speaker is
    // ready for it rather than the moment the deck loads.
    return scene()
      .beat(rule.line(0))
      .step(rule.line(1, { at: "150ms" }))
      .settle();
  },
};
