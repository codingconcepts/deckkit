import { slide, scene, GLYPHS, compact } from "deckkit";

export default {
  id: "G1Cluster",
  label: "Clusters",

  build(svg) {
    const s = slide(svg, {
      title: "Seven nodes, two failures, no drama",
      strap: "cluster() owns the meters, the labels, the badge and the arithmetic",
    });

    const c = s.cluster({
      count: 7,
      glyph: GLYPHS.disc,
      demand: 42000,
      target: 0.55,
      pressure: 0.72,
      load: (v) => `${compact(v)} rps`,
      down: "lost",
    });

    const say = s.captions([
      "Seven nodes at 55%, because that's what 42k rps divided seven ways comes to.",
      { text: "Lose one and the survivors carry it: 64%, and still serving.",
        status: "critical" },
      { text: "Lose a second and it's 77%. Still under the line.", status: "critical" },
      "Demand is a property of the workload. Losing a node removes none of it.",
    ]);

    return scene()
      .step(s.open(), c.enter())
      .beat(c.serve(), say(0))
      .beat(c.fail(6), say(1))
      .beat(c.fail(2), say(2))
      .beat(c.heal(2), c.heal(6), say(3))
      .settle();
  },
};
