/* A list of statements, one per beat.

   Not the same thing as a caption slot. A caption replaces the sentence
   before it; a list keeps them, because the argument is cumulative and the
   audience should be able to see the first point while you make the second.

   Each item can carry a note underneath it - the evidence, in a colour that
   says whether it supports the point or undercuts it - and the note is a
   separate beat, so a presenter can state a claim and then back it. */

import { body } from "../core/stage.js";
import { region, SLOT } from "../core/layout.js";
import { together } from "../anim/combinators.js";
import { reveal, exit } from "../anim/steps.js";

export function bullets(parent, items, opts = {}) {
  const {
    box = region(), x = box.left, y = SLOT.caption - 64,
    pitch = 54, size = 24, noteSize = 22, numbered = true, indent = 0,
  } = opts;

  const built = items.map((item, i) => {
    const spec = typeof item === "string" ? { text: item } : item;
    const top = y + i * pitch;
    const prefix = numbered ? `${i + 1}.  ` : "";
    return {
      text: body(parent, prefix + spec.text, size, spec.status ? { status: spec.status } : "ink",
                 { x: x + indent, y: top, opacity: 0 }),
      note: spec.note === undefined ? null
        : body(parent, spec.note, noteSize,
               spec.noteStatus ? { status: spec.noteStatus } : "muted",
               { x: x + indent + (numbered ? 30 : 0), y: top + 32, opacity: 0 }),
    };
  });

  return {
    items: built,
    parts: built.flatMap((b) => [b.text, b.note].filter(Boolean)),

    /* State the point. */
    show: (i, o = {}) => reveal(built[i].text, { from: "below", duration: 0.7, ...o }),

    /* Then back it. */
    back: (i, o = {}) => (built[i].note
      ? reveal(built[i].note, { from: "below", duration: 0.6, ...o })
      : null),

    /* Point and evidence together, for the item that doesn't need two
       beats. */
    both: (i, o = {}) => together(
      reveal(built[i].text, { from: "below", duration: 0.7, ...o }),
      built[i].note ? reveal(built[i].note, { from: "below", duration: 0.6 }) : null,
    ),

    clear: (i, o = {}) => exit([built[i].text, built[i].note].filter(Boolean),
                               { duration: 0.4, ...o }),
  };
}
