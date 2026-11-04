/* A static server, for the length of one export.

   The deck is ES modules, so file:// is out - a module script loaded from
   a file URL is a cross-origin request to the browser, and the deck never
   loads. Something has to serve the folder, and `vite preview` is a
   bigger ask than fifty lines: the export has to work against a built
   deck on a machine that has only the published package.

   Bound to loopback on an ephemeral port, serving one directory, for as
   long as the recording takes. */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

export async function serve(dir) {
  const root = resolve(dir);
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`export: ${dir} is not a directory`);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname);

    /* Normalise before joining, and check the result is still inside the
       root. The server is loopback-only and lives for a minute, but
       "..%2f.." reaching the home directory is not a thing to leave
       working on the grounds that it's probably unreachable. */
    const path = normalize(join(root, requested));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    let file = path;
    const found = await stat(file).catch(() => null);
    if (found?.isDirectory()) file = join(file, "index.html");

    const final = await stat(file).catch(() => null);
    if (!final?.isFile()) {
      res.writeHead(404).end("not found");
      return;
    }

    res.writeHead(200, {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "content-length": final.size,
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  });

  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.();
        server.close(done);
      }),
  };
}
