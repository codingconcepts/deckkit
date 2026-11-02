import { resolve } from "node:path";
import { defineConfig } from "vite";

/* Building one deck as a static site.

   `npx vite build examples/sizing` from the repo root, or `npx vite build`
   from here. The output is a folder you can drop on any static host - which
   is how a deck gets shared with people who aren't going to clone a repo.

   The alias is the in-repo shortcut: a deck outside this repository depends
   on `deckkit` from npm and needs none of this file. */
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  resolve: {
    alias: { deckkit: resolve(import.meta.dirname, "../../src/index.js") },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
