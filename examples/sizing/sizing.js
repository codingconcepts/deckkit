/* This deck, said in this deck's words.

   A thin layer over deckkit: the marks and the frame are generic, and what
   gets added here is everything that knows the subject - that x is a day,
   that y is throughput, that a workload carries a colour slot it keeps from
   the title card to the summary.

   Thin on purpose. If a function here is doing more than binding a generic
   one to the domain, it either belongs in the library or it belongs in a
   scene. */

import { stats, hourTick, compact, blockPath, stackColumn, columnsAt } from "deckkit";
import { CURVES } from "./curves.js";

// Every scene reads the same list, so a workload keeps its colour slot from
// the title card to the summary.
export const WORKLOADS = CURVES.workloads;

/* The day. Ticks are landmarks rather than even divisions: midnight, the
   start of business, midday, the evening peak, midnight again. */
export const DAY = { domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: hourTick };

// The cluster the peak of the sum actually lands on. Node count and node
// size are the only figures in the project that don't come out of the data,
// because nothing in the data knows what hardware it ran on.
export const NODES = 5;
export const NODE_VCPU = 16;
export const TARGET_UTIL = 0.6;  // vCPU utilisation at the peak of the sum
export const PRESSURE = 0.7;     // above this a node is working, not resting

/* The arithmetic this argument is made of.

   The generic half - where a series peaks, what a set of them comes to, the
   wide shape d3.stack wants, and both headline figures - is stats(), bound
   here to the 24h grid in curves.js. */
export const DATA = (() => {
  const grid = stats(CURVES.hours);

  /* The scatter correlated() applies, in hours, one per workload.

     Lifted out of the numpy generator the video was cut with:

         rng = np.random.default_rng(11)
         [rng.uniform(-0.5, 0.5) for _ in range(8)]

     The summary beat ends on a percentage, and that percentage is sensitive
     to exactly how far apart the peaks land, so the offsets are data rather
     than something re-rolled per implementation. */
  const SCATTER = [-0.37143, -0.000722, 0.101498, -0.471311,
                   -0.352074, 0.428211, -0.429579, -0.370226];

  /* The same workloads with every peak rolled onto roughly one hour.

     Consolidation only pays when peaks are offset; if every workload tops
     out at the same moment, peak-of-sum converges on sum-of-peaks and the
     saving is gone. SCATTER spreads the peaks rather than stacking them
     exactly, because perfectly aligned peaks are a strawman - the point is
     that the saving collapses, not that it reaches zero. */
  const correlated = (workloads, centre = 19.5) =>
    workloads.map((w, i) => grid.alignTo(w, centre + SCATTER[i % SCATTER.length]));

  return { ...grid, HOURS: grid.xs, correlated };
})();

/* Shorthands the scenes use by name rather than by arithmetic. */
export const sumOfPeaks = DATA.sumOfPeaks;
export const peakOfSum = DATA.peakOfSum;
export const saving = DATA.consolidation;

/* The key, in slot order. One list, so no scene invents its own. */
export const KEY = WORKLOADS.map((w) => ({ label: w.label, slot: w.slot }));

/* A shared y-scale across any chart of these curves.

   Small multiples share a scale or the comparison is a lie, and two scenes
   agreeing on the same ceiling by having both been typed the same way is
   not sharing a scale. Said once, here. */
export const PEAKS = { data: WORKLOADS.map(DATA.peak), headroom: 1.15 };

/* What you actually provision, once a lost node's share lands on the rest.

   The N-1 rule: size so that N-1 nodes can carry what N were carrying.
   Hardware arithmetic rather than demand arithmetic, so it lives up here
   with NODES rather than down with the curves. */
export const withNMinusOne = (value) => (value * NODES) / (NODES - 1);

/* The stack, as deckkit's band() wants it. */
export const stackOf = (workloads) => ({
  rows: DATA.rows(workloads),
  keys: workloads.map((w) => w.name),
  slots: workloads.map((w) => w.slot),
});

/* Each workload's peak as a block standing at the hour it happens.

   Walked at the same point count as a demand curve, so a curve morphs into
   its own block instead of cross-fading to it: the squeeze is the argument,
   and it only reads if the line visibly becomes the number. Blocks that
   would overlap are nudged apart - a scene captioned "eight of them" has to
   show eight. */
export const peakSpikes = (ax, workloads, opts) =>
  columnsAt(workloads.map((w) => ax.x(DATA.peakAt(w))),
            workloads.map((w) => ax.y(DATA.peak(w))),
            opts)
    .map((r) => blockPath(DATA.HOURS.length, r));

/* The same peaks with the clock taken away: one stacked column.

   The bill sum-of-peaks produces, with every workload's contribution still
   its own block. Same point count and same list order as peakSpikes(), so a
   spike morphs into its own slice of the column. */
export const peakColumn = (workloads, box) =>
  stackColumn(workloads.map(DATA.peak), box).map((r) => blockPath(DATA.HOURS.length, r));

/* The aggregate, as a series the chart can draw like any other. */
export const aggregate = (workloads) => ({ values: DATA.total(workloads) });

export const qps = (v) => `${compact(v)} qps`;
