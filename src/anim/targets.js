/* What a step can be pointed at.

   Scene code holds a mixture: d3 selections, multi-element selections from
   .join(), the component objects this library hands back, and plain arrays
   of any of those. Resolving all of them here is what keeps `.node()` and
   `.map(n => n.node())` out of the scenes, which is most of the noise a
   build method would otherwise carry.

   The `parts` convention is the contract a component opts into: anything
   with a `parts` array animates as a whole when you hand the component
   itself to a step, while still letting a scene reach in for one piece. */
export function nodes(target) {
  if (!target) return [];
  if (Array.isArray(target)) return target.flatMap(nodes);
  if (target.nodeType) return [target];                           // a DOM node
  if (typeof target.nodes === "function") return target.nodes();  // d3 selection
  if (Array.isArray(target.parts)) return nodes(target.parts);    // a component
  if (target.g) return nodes(target.g);
  if (typeof target.node === "function") return [target.node()];
  return [target];
}
