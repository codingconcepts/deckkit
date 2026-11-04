/* A headless browser, without a browser automation library.

   Rendering the deck needs a real engine - it's SVG, CSS custom
   properties and a layout pass, and the one thing worse than depending on
   Chrome is reimplementing it. What it doesn't need is Playwright or
   Puppeteer: the whole job is navigate, evaluate, screenshot, and the
   DevTools protocol speaks all three over a WebSocket that Node has had
   built in since 22.

   So this is the client: find Chrome, start it with a debugging port,
   send JSON, await replies by id. About a hundred lines, against a
   dependency that downloads a second copy of Chromium into every machine
   that installs the library - for a feature most decks never run. */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Where Chrome lives, in rough order of how likely it is to be the one
   the user means. CHROME_PATH first, because the one case this list can't
   cover is the machine that keeps it somewhere else. */
const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

export async function findChrome() {
  const { access } = await import("node:fs/promises");
  const paths = [process.env.CHROME_PATH, ...(CANDIDATES[process.platform] ?? [])];
  for (const path of paths) {
    if (!path) continue;
    try {
      await access(path);
      return path;
    } catch {
      /* next */
    }
  }
  throw new Error(
    "export: no Chrome found. Install Google Chrome or Chromium, or set CHROME_PATH " +
      "to the browser binary.",
  );
}

/* The port Chrome actually took.

   Asking for port 0 means "pick one", which is the only way two exports
   can run at once; Chrome writes the number it chose into the profile
   directory once it's listening, so that file is also the readiness
   signal. */
async function readPort(dir, proc, timeout = 30000) {
  const file = join(dir, "DevToolsActivePort");
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`export: Chrome exited (${proc.exitCode})`);
    try {
      const [port] = (await readFile(file, "utf8")).split("\n");
      if (port) return Number(port);
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("export: Chrome did not start a debugging port in time");
}

/* Ask the browser to go, then insist.

   A SIGTERM is enough for a browser that's idle, and an export leaves it
   idle - but a hung renderer would otherwise leave the command waiting
   on a process that is never going to exit, which is a worse failure
   than a killed one. */
async function stop(proc, grace = 5000) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise((done) => proc.once("exit", done));
  proc.kill("SIGTERM");
  const timer = setTimeout(() => proc.kill("SIGKILL"), grace);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

/* The DevTools protocol, as a request/response client.

   Commands are JSON with an id and a method; replies come back out of
   order with the same id, so the pending map is the whole protocol.
   Events are JSON without an id, and nothing here needs them - every wait
   in the recorder is a poll on page state rather than a lifecycle event,
   because the deck's own readiness (`window.__deckkit__`) is a stricter
   signal than `Page.loadEventFired` anyway. */
class Session {
  #ws;
  #id = 0;
  #pending = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const entry = this.#pending.get(msg.id);
      if (!entry) return;
      this.#pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(`${msg.error.message} (${entry.method})`));
      else entry.resolve(msg.result);
    });
    const fail = (reason) => () => {
      for (const [, entry] of this.#pending) entry.reject(new Error(reason));
      this.#pending.clear();
    };
    ws.addEventListener("close", fail("export: browser connection closed"));
    ws.addEventListener("error", fail("export: browser connection failed"));
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /* Evaluate in the page, and surface a thrown error as a thrown error
     rather than as a result object nobody reads. */
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const { exception, text } = result.exceptionDetails;
      throw new Error(`export: page error: ${exception?.description ?? text}`);
    }
    return result.result.value;
  }

  close() {
    this.#ws.close();
  }
}

/* Start a browser and attach to its first page.

   The device metrics override is what makes the output exactly the size
   it was asked for: the window is a suggestion - it carries chrome, it
   gets clamped by the display - and the override isn't. */
export async function launch({ width, height, scale = 1, headless = true }) {
  const binary = await findChrome();
  const profile = await mkdtemp(join(tmpdir(), "deckkit-"));

  const args = [
    headless ? "--headless=new" : null,
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
    "--mute-audio",
    "about:blank",
  ].filter(Boolean);

  const proc = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-2000);
  });

  let session;
  try {
    const port = await readPort(profile, proc);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    const page = targets.find((t) => t.type === "page");
    if (!page) throw new Error("export: Chrome opened no page to attach to");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("export: cannot reach Chrome")), {
        once: true,
      });
    });

    session = new Session(ws);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    });
  } catch (error) {
    await stop(proc);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw new Error(`${error.message}${stderr ? `\n${stderr.trim()}` : ""}`);
  }

  return {
    /* Go to a URL and wait for the deck to announce itself.

       Polling for the global beats waiting on the load event: a built
       deck loads its bundle after load fires, and a dev server may still
       be compiling. Either way the thing being waited for is the deck,
       not the document. */
    async open(url, timeout = 30000) {
      await session.send("Page.navigate", { url });
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const ready = await session.evaluate(
          "!!(window.__deckkit__ && window.__deckkit__.capture)",
        );
        if (ready) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(
        `export: ${url} never produced a deck. The page has to call createDeck() ` +
          "from deckkit 0.2 or later.",
      );
    },

    evaluate: (expression) => session.evaluate(expression),

    /* Change the frame size without reloading.

       The deck's stage size isn't knowable until the deck has loaded, so
       the first viewport is a guess and this is the correction. An
       override replaces the previous override, and the page reflows - no
       navigation, so the built scenes survive it. */
    resize: (w, h, factor = scale) =>
      session.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: h,
        deviceScaleFactor: factor,
        mobile: false,
      }),

    async screenshot() {
      const { data } = await session.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      return Buffer.from(data, "base64");
    },

    /* Shut down, in order: the socket, the browser, the profile.

       The order is the whole of it. Chrome writes to its profile
       directory right up until it exits, so removing it while the
       process is still going is an ENOTEMPTY waiting for a slow machine
       - which is exactly the machine an export runs longest on. */
    async close() {
      try {
        session?.close();
      } catch {
        /* already gone */
      }
      await stop(proc);
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
