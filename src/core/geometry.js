/* Path arithmetic: the shapes that have to be generated rather than drawn.

   Mostly this exists for morphing. GSAP has no path morph in the free build
   and doesn't need one: shapes generated with matching point counts and
   matching command sequences interpolate exactly under d3.interpolateString. */

import * as d3 from "d3";

/* Prime a stroked path for a draw-on. Returns its length, so the caller can
   tween stroke-dashoffset to zero - the SVG equivalent of Create(). The
   draw() step is the other half. */
export function primeDrawOn(path) {
  const length = path.node().getTotalLength();
  path.attr("stroke-dasharray", length).attr("stroke-dashoffset", length);
  return length;
}

/* n points walked at equal arc length around a rectangle, starting at the
   bottom-left corner and closing back onto it.

   Morphing a line into a block needs the two shapes to have the same point
   count and the same command sequence, or d3.interpolateString has nothing
   to interpolate. A curve is an open polyline of n points; this gives a
   rectangle with exactly the same n, which is what makes it legal. */
export function rectPerimeter(n, x0, y0, x1, y1) {
  const corners = [[x0, y1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const lengths = d3.range(4).map((i) =>
    Math.hypot(corners[i + 1][0] - corners[i][0], corners[i + 1][1] - corners[i][1]));
  const total = d3.sum(lengths) || 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    let walked = (i / (n - 1)) * total;
    let side = 0;
    while (side < 3 && walked > lengths[side]) { walked -= lengths[side]; side++; }
    const [a, b] = [corners[side], corners[side + 1]];
    const u = lengths[side] ? walked / lengths[side] : 0;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

export const polyline = (points) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");

/* A rectangle as an n-point open polyline: the shape a curve of n samples
   can legally morph into.

   rectPerimeter() and polyline() are never useful apart - the point of
   walking a rectangle at equal arc length is to get a d-string out of the
   far end - so this is the pair, said once. `r` is {x0, y0, x1, y1}, which
   is what the layout helpers hand back. */
export const blockPath = (n, r) => polyline(rectPerimeter(n, r.x0, r.y0, r.x1, r.y1));

/* Spread marks that would overlap, keeping each cluster on its centre.

   Drawn at their true position, two marks inside the gap hide behind a
   third, and a scene captioned "eight of them" has to show eight. The nudge
   is symmetric about the real cluster centre, so nothing moves to a
   materially different place on the axis. */
export function dodge(positions, gap) {
  const out = positions.slice();
  const order = d3.range(out.length).sort((a, b) => out[a] - out[b]);
  let start = 0;
  for (let end = 1; end <= order.length; end++) {
    if (end < order.length && out[order[end]] - out[order[end - 1]] < gap) continue;
    const members = order.slice(start, end);
    const centre = d3.mean(members, (i) => out[i]);
    members.forEach((i, k) => {
      out[i] = centre + (k - (members.length - 1) / 2) * gap;
    });
    start = end;
  }
  return out;
}

/* A rounded rectangle, as a path rather than a rect.

   `<rect rx>` would do, except a box that has to morph into another shape
   needs to be a path to begin with - and a deck with two kinds of box in it
   is a deck where one of them animates differently for no reason the
   audience can see. */
export function roundRect(x, y, width, height, r = 6) {
  const radius = Math.min(r, width / 2, height / 2);
  return [
    `M${x + radius},${y}`,
    `H${x + width - radius}`, `A${radius},${radius} 0 0 1 ${x + width},${y + radius}`,
    `V${y + height - radius}`, `A${radius},${radius} 0 0 1 ${x + width - radius},${y + height}`,
    `H${x + radius}`, `A${radius},${radius} 0 0 1 ${x},${y + height - radius}`,
    `V${y + radius}`, `A${radius},${radius} 0 0 1 ${x + radius},${y}`,
    "Z",
  ].join("");
}

/* An elbow between two points: out along one axis, then along the other.

   Diagonals read as "related to"; right angles read as "flows into", which
   is what a diagram of boxes almost always means. `bend` picks which axis
   leads, and "auto" leads with whichever gap is wider - that keeps the turn
   away from the box it's leaving. */
export function elbow(from, to, { bend = "auto", radius = 10 } = {}) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const horizontal = bend === "h" || (bend === "auto" && Math.abs(x1 - x0) >= Math.abs(y1 - y0));
  if (Math.abs(x1 - x0) < 1 || Math.abs(y1 - y0) < 1) return `M${x0},${y0}L${x1},${y1}`;

  const mid = horizontal ? [(x0 + x1) / 2, y0] : [x0, (y0 + y1) / 2];
  const turn = horizontal ? [(x0 + x1) / 2, y1] : [x1, (y0 + y1) / 2];
  const r = Math.min(radius, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);

  return horizontal
    ? `M${x0},${y0}H${mid[0] - sx * r}Q${mid[0]},${y0} ${mid[0]},${y0 + sy * r}` +
      `V${turn[1] - sy * r}Q${mid[0]},${y1} ${mid[0] + sx * r},${y1}H${x1}`
    : `M${x0},${y0}V${mid[1] - sy * r}Q${x0},${mid[1]} ${x0 + sx * r},${mid[1]}` +
      `H${turn[0] - sx * r}Q${x1},${mid[1]} ${x1},${mid[1] + sy * r}V${y1}`;
}

/* A triangular arrowhead at `point`, aimed along `angle` (radians).

   A path rather than a marker element: markers don't inherit a tween, so an
   arrow drawn on with stroke-dashoffset arrives with its head already in
   place at the far end, which gives the move away. */
export function arrowHead([x, y], angle, size = 9) {
  const wing = (turn) => [
    x - size * Math.cos(angle - turn),
    y - size * Math.sin(angle - turn),
  ];
  const [ax, ay] = wing(0.42);
  const [bx, by] = wing(-0.42);
  return `M${x},${y}L${ax},${ay}L${bx},${by}Z`;
}
