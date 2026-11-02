/* A key. Always present past one series - identity is never colour alone.

   `entries` is [{label, slot}], already in the order they should read.
   `reverse` flips that order to match a bottom-up stack, which is the one
   case where the legend and the data disagree about which way is first. */

import { el, body } from "../core/stage.js";
import { paint } from "../core/theme.js";

export function key(parent, entries, opts = {}) {
  const { x = 0, y = 0, rowH = 30, reverse = false, size = 17 } = opts;
  const g = parent.append("g").attr("transform", `translate(${x},${y})`);
  const rows = reverse ? [...entries].reverse() : entries;
  rows.forEach((entry, i) => {
    const line = g.append("g").attr("transform", `translate(0,${i * rowH})`);
    el(line, "rect", { width: 13, height: 13, y: -11, fill: paint(entry) });
    body(line, entry.label, size, "ink2", { x: 22 });
  });
  return g;
}
