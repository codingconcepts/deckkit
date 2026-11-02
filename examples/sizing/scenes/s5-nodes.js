/* S5Nodes - the cluster that number lands on, and what happens when it
   shrinks.

   Everything up to here is an argument about one figure: the peak of the
   sum, and the capacity you don't have to buy to serve it. This is where
   the figure meets hardware. N nodes share the demand, so each one sits
   well short of its vCPU; then one node leaves and the demand doesn't leave
   with it. The jump from TARGET_UTIL to the N-1 figure is the concrete form
   of the headroom S6 asks you to pay for, which is why it runs immediately
   before it.

   The whole scene is a cluster component and four captions. The meters, the
   split-flapped throughput labels, the "down" badge and the arithmetic that
   re-divides the load all come from cluster(); what is left here is the
   running order and the words. */

import { slide, scene, body, enter, percent, GLYPHS } from "deckkit";
import { WORKLOADS, DATA, NODES, NODE_VCPU, TARGET_UTIL, PRESSURE, qps } from "../sizing.js";

export default {
  id: "S5Nodes",
  label: "One cluster",

  build(svg) {
    const peak = DATA.peakOfSum(WORKLOADS);

    const s = slide(svg, {
      title: "One cluster. N nodes.",
      strap: `${qps(peak)}, the peak of the sum, across N = ${NODES} nodes of ${NODE_VCPU} vCPU`,
    });

    const cluster = s.cluster({
      count: NODES,
      glyph: GLYPHS.cockroach,
      demand: peak,
      target: TARGET_UTIL,
      pressure: PRESSURE,
      load: qps,
    });

    // The node that fails is the last one, so the row reads left to right
    // and nothing the audience is already looking at moves when it goes.
    const victim = NODES - 1;

    const scaleNote = body(svg, "each bar is that node's vCPU utilisation", 16, "muted",
                           { x: 640, y: cluster.geometry.loadY + 32, anchor: "middle" });

    const say = s.captions([
      `The peak divides ${NODES} ways. No one node is working too hard.`,
      { text: "Lose a node and the load redistributes.", status: "critical" },
      "When the node returns, it shares the load again. " +
        `The room above ${percent(TARGET_UTIL)} is the N-1 headroom.`,
    ]);

    return scene()
      .step(s.open(), cluster.enter(), enter(scaleNote, { duration: 0.6, at: "<" }))

      // Five idle nodes and five empty meters, waiting. Worth a hold: this
      // is where you say what a meter is before any of them move.
      .beat(cluster.serve(), say(0))

      // Take a node away. Demand is a property of the workloads, not of the
      // cluster, so none of it disappears with the node - the survivors
      // pick it up and the meters are where you watch that happen.
      .beat(cluster.fail(victim), say(1))

      // 75% and nothing on fire. The longest hold in the deck belongs here.
      .beat(cluster.heal(victim), say(2))
      .settle(1.8);
  },
};
