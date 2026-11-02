/* A cluster of nodes, and what happens when one of them leaves.

   This is the component the library exists for. Hand-written, a cluster
   scene is a row of cylinders, a meter under each, a throughput label under
   that, a "down" badge for the node that fails, four sets of labels for the
   four states the cluster passes through, and the arithmetic that says what
   each survivor is carrying - about 120 lines, most of it bookkeeping, and
   all of it rewritten from scratch for the next deck.

   The arithmetic is the part worth saying once. Demand is a property of the
   workload, not of the cluster: an outage removes none of it, it just
   divides between fewer nodes. Everything else here follows from that one
   sentence.

   State is tracked across the build, so `fail(4)` knows what the cluster
   looked like before it and `heal(4)` knows what to put back. Because a
   scene is built in running order, that tracking is exact. */

import * as d3 from "d3";
import { el, body } from "../core/stage.js";
import { THEME } from "../core/theme.js";
import { region, fitRow, centreOf } from "../core/layout.js";
import { compact, percent } from "../core/format.js";
import { cylinder, NODE } from "../brand/cylinder.js";
import { meter, heat } from "../marks/gauge.js";
import { mark } from "../anim/scene.js";
import { together, after } from "../anim/combinators.js";
import { enter, fadeTo, flap, drive } from "../anim/steps.js";

export function cluster(parent, opts = {}) {
  const {
    count = 5,
    box = region(),
    cy,
    glyph,
    shape = cylinder,
    width,
    gap = 72,
    // What the cluster is carrying, and how hard that makes it work.
    demand = 0,
    target = 0.6,       // utilisation per node with every node up
    pressure = 0.7,     // above this a node is drawn as working, not resting
    meters: wantMeters = true,
    ceiling = "critical",
    load = (v) => `${compact(v)} qps`,
    reading = percent,
    down = "down",
  } = opts;

  /* Geometry. One row, centred, with the meter and its figure hung
     underneath - so the whole assembly is positioned by the node centre and
     a scene never writes a second y for the track. */
  const nominal = width ?? NODE.width;
  const slots = fitRow(count, {
    box, cy: cy ?? centreOf(box).cy, max: nominal, ratio: gap / nominal,
  });
  const nodeWidth = slots[0].right - slots[0].left;
  const nodeHeight = NODE.height * (nodeWidth / NODE.width);

  /* The whole assembly is centred, not the node.

     A node is the tallest thing here but it's not the only thing: the
     meter and the throughput figure hang below it, and centring the
     cylinder leaves that tail sitting in the bottom of the region with a
     band of empty plane above it. `below` is how far the assembly reaches
     past the node, and half of it's the correction. */
  const below = wantMeters ? 115 : 34;
  const centreY = cy ?? centreOf(box).cy - below / 2;
  const TRACK_Y = centreY + nodeHeight / 2 + 38;
  const LOAD_Y = wantMeters ? TRACK_Y + 77 : centreY + nodeHeight / 2 + below;

  const at = (i) => slots[i].cx;

  const units = d3.range(count).map((i) =>
    shape(parent, { cx: at(i), cy: centreY, width: nodeWidth, height: nodeHeight, glyph }));

  const gauges = wantMeters
    ? d3.range(count).map((i) =>
        meter(parent, {
          cx: at(i), y: TRACK_Y, width: nodeWidth, ceiling, format: reading,
          colour: heat("good", { pressure }), textColour: heat("ink", { pressure }),
        }))
    : [];

  /* Per-node utilisation and throughput, given which nodes are up.

     `shares` is one weight per node - 1 for up, 0 for down, or any
     proportion for a cluster that isn't balanced. An all-zero cluster is a
     legal state, because a scene usually opens on idle nodes before any
     load arrives. */
  const loadOf = (shares) => {
    const live = d3.sum(shares);
    if (!live) return shares.map(() => ({ util: 0, load: 0 }));
    return shares.map((s) => ({
      util: (target * count * s) / live,
      load: (demand * s) / live,
    }));
  };

  /* The throughput line under each percentage, for one cluster state.

     Split-flapped rather than counted: throughput per node doesn't pass
     through the values in between when a node leaves - the work is simply
     re-divided - and a counter ticking 1.8k up to 2.2k would imply a ramp
     that isn't there. The percentages sweep, because utilisation really
     does climb. Each state gets its own set of labels so the swap reverses
     cleanly when the deck is scrubbed backwards. */
  const labelsFor = (shares, opacity = 0) =>
    loadOf(shares).map((r, i) =>
      body(parent, load(r.load, r), 17, "muted",
           { x: at(i), y: LOAD_Y, anchor: "middle", opacity }));

  // On its own chip rather than straight onto the node: even dimmed, the
  // mark behind it leaves the word unreadable.
  const badges = d3.range(count).map((i) => {
    const g = parent.append("g").attr("opacity", 0);
    el(g, "rect", {
      x: at(i) - 38, y: centreY - 17, width: 76, height: 34,
      fill: THEME.surface, stroke: THEME.critical, "stroke-width": THEME.hairline,
    });
    body(g, down, 20, { status: "critical" }, { x: at(i), y: centreY + 7, anchor: "middle" });
    return g;
  });

  // Build-time state: what the cluster is doing, and which set of labels is
  // currently the visible one.
  let shares = Array(count).fill(0);
  let labels = labelsFor(shares, 1);

  /* Move the cluster to a new set of shares.

     Throughput first, utilisation second, in both directions: the load
     arriving is the cause and the meter climbing is the effect, so they are
     two beats rather than one simultaneous blur. */
  const shareStep = (next, o = {}) => (tl, position) => {
    const { duration = 1.4, lag = 0.5 } = o;
    const label = mark(tl, position);
    const incoming = labelsFor(next);
    flap(labels, incoming)(tl, label);
    after(lag, ...gauges.map((m, i) => drive(m, loadOf(next)[i].util, { duration })))(tl, label);
    labels = incoming;
    shares = next;
  };

  const api = {
    g: parent,
    nodes: units,
    meters: gauges,
    slots,
    at,
    geometry: { cy: centreY, trackY: TRACK_Y, loadY: LOAD_Y, width: nodeWidth, height: nodeHeight },

    /* What the cluster is carrying right now, per node. Live at build time,
       so a caption can quote a figure the animation is about to show. */
    load: (s = shares) => loadOf(s),
    shares: () => shares.slice(),

    /* The cluster arriving: nodes in sequence, then the meters and the
       figures under them. Idle - no load until a scene gives it some. */
    enter: (o = {}) => together(
      enter(units, { from: "below", distance: 16, duration: 0.45, stagger: 0.12, ...o }),
      gauges.length ? enter(gauges, { duration: 0.6 }) : null,
      enter(labels, { duration: 0.6 }),
    ),

    /* Take the load. The step a scene makes after saying what a meter is. */
    serve: (o = {}) => shareStep(Array(count).fill(1), o),
    idle: (o = {}) => shareStep(Array(count).fill(0), o),
    share: (next, o = {}) => shareStep(next, o),

    /* Lose a node. The survivors pick its share up, which is the whole
       point - nothing about the demand changed.

       Only this node changes: a second fail() on a cluster that has
       already lost one must not quietly bring the first one back, which is
       exactly what rebuilding the share list from "everything else is up"
       would do. */
    fail: (i, o = {}) => (tl, position) => {
      const label = mark(tl, position);
      const next = shares.map((s, k) => (k === i ? 0 : s));
      fadeTo(units[i], 0.14, { duration: 0.6 })(tl, label);
      fadeTo(badges[i], 1, { duration: 0.6 })(tl, label);
      shareStep(next, { lag: 0.6, duration: 1.5, ...o })(tl, label);
    },

    /* And give it back - this one, and nothing else. */
    heal: (i, o = {}) => (tl, position) => {
      const label = mark(tl, position);
      const next = shares.map((s, k) => (k === i ? 1 : s));
      fadeTo(units[i], 1, { duration: 0.6 })(tl, label);
      fadeTo(badges[i], 0, { duration: 0.6 })(tl, label);
      shareStep(next, { lag: 0.6, duration: 1.5, ...o })(tl, label);
    },

    parts: [units, gauges, labels],
  };
  return api;
}
