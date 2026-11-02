import { resolve } from "node:path";
import { defineConfig } from "vite";

/* The components deck, built the same way the sizing deck is.

   Where `examples/sizing` is a talk that happens to use the library, this
   one is the library with a talk wrapped round it: one scene per component
   family, default theme, no overrides. It's the thing to open when the
   question is "what does `cluster()` look like" rather than "how do I pace
   a deck".

   Identical to the sizing config by design - a second example that needs a
   different build is a second example nobody can copy. */
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  resolve: {
    alias: { deckkit: resolve(import.meta.dirname, "../../src/index.js") },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
