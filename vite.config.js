import { resolve } from "node:path";
import { defineConfig } from "vite";

/* Two jobs from one config.

   `npm run dev` serves the repo root, so every deck under examples/ is
   reachable at /examples/<name>/ with hot reload - which is the thing a
   build step costs you and has to give back. It opens the sizing deck,
   because serving the root alone would land you on a directory listing.

   `npm run build` switches to library mode: one ESM bundle, one CJS, and
   the HUD stylesheet alongside them. d3 and gsap stay external, because a
   deck that bundles its own copy of d3 next to the one its page already
   loaded is paying twice for the same scales. */
export default defineConfig({
  resolve: {
    alias: { deckkit: resolve(import.meta.dirname, "src/index.js") },
  },
  server: { open: "/examples/sizing/" },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.js"),
      name: "deckkit",
      fileName: (format) => (format === "es" ? "deckkit.js" : "deckkit.cjs"),
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["d3", "gsap"],
      output: { assetFileNames: "deckkit.[ext]", globals: { d3: "d3", gsap: "gsap" } },
    },
  },
});
