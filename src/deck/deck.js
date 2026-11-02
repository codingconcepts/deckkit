/* The deck: navigation, beats, scrubbing, speed, and getting out of the way.

   A scene is `{ id, label, build(svg) -> timeline }`. The deck builds the
   markup it needs, so a project's index.html is a container and a script
   tag rather than forty lines of HUD nobody edits.

   The thing that makes this a deck rather than n videos is beats: a scene
   parks partway through so it can be talked over, and the arrow keys walk
   the beats first, only changing slide once a scene has none left. */

import * as d3 from "d3";
import { W, H } from "../core/stage.js";
import "./deck.css";

const SPEEDS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const html = (tag, className, props = {}) =>
  Object.assign(document.createElement(tag), { className, ...props });

export function createDeck(opts = {}) {
  const {
    scenes, mount = document.body, speed = 1, hud: wantHud = true,
    width = W, height = H, start = 0,
  } = opts;
  if (!scenes || !scenes.length) throw new Error("createDeck: no scenes");

  mount.classList.add("dk");
  const stage = html("div", "dk-stage");
  mount.appendChild(stage);

  // ---- the HUD -----------------------------------------------------------

  const hud = html("div", "dk-hud");
  const button = (label, title, onClick) => {
    const b = html("button", "", { textContent: label, title });
    b.addEventListener("click", onClick);
    return b;
  };

  const position = html("span", "dk-position");
  const label = html("span", "dk-label");
  const dots = html("div", "dk-dots");
  const scrub = html("input", "dk-scrub", { type: "range", min: 0, max: 1000, value: 0 });
  scrub.setAttribute("aria-label", "Scrub scene");

  const speedButton = button("1x", "Speed (s)", () => openSpeedMenu());
  speedButton.setAttribute("aria-haspopup", "listbox");
  const speedList = html("div", "dk-menu-list", { hidden: true });
  speedList.setAttribute("role", "listbox");
  const speedMenu = html("div", "dk-menu");
  speedMenu.append(speedButton, speedList);

  const hideButton = button("Hide", "Hide controls (h)", () => toggleControls());

  hud.append(
    button("←", "Previous (←)", () => prev()),
    position,
    button("→", "Next (→ or space)", () => next()),
    label, dots, scrub,
    button("Replay", "Replay (r)", () => replay()),
    speedMenu, hideButton,
    html("span", "dk-keys", { textContent: "← → space · r · s · f · h" }),
  );
  if (wantHud) mount.appendChild(hud);

  // ---- slides ------------------------------------------------------------

  let speedIndex = Math.max(0, SPEEDS.indexOf(speed));
  let current = -1;

  const slides = scenes.map((scene) => ({ scene, svg: null, tl: null }));

  slides.forEach((slide, i) => {
    const dot = html("button", "dk-dot", { title: slide.scene.label ?? slide.scene.id });
    dot.addEventListener("click", () => go(i));
    dots.appendChild(dot);
  });

  /* Scenes are built on first visit: eight stacked areas and five cylinders
     aren't free, and a deck that stalls for half a second on load looks
     broken in a way that one stalling on slide four doesn't. */
  function ensure(slide) {
    if (slide.tl) return slide.tl;
    slide.svg = d3
      .select(stage)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", slide.scene.label ?? slide.scene.id)
      .style("display", "none");
    slide.tl = slide.scene.build(slide.svg);
    slide.tl.eventCallback("onUpdate", () => {
      if (slides[current] === slide) syncHud();
    });
    return slide.tl;
  }

  // ---- beats -------------------------------------------------------------

  const EPS = 1e-3;
  const stopsOf = (tl) => (tl.data && tl.data.stops) || [];
  const finished = (tl) => tl.progress() >= 1 - 1e-6;

  /* Seek, with callbacks left switched on.

     GSAP's pause(atTime) suppresses events by default, and several things
     on screen are drawn *by* an onUpdate rather than by a tweened property
     - path morphs, counters, meters. Suppress the callbacks and those keep
     whatever shape they were last rendered at, so jumping between beats
     leaves a stale curve or a counter reading zero. */
  const seek = (tl, time) => tl.pause(time, false);

  /* Which beat the playhead is sitting on, counting from one.

     Strictly-before, not at-or-before: landing on a hold means the segment
     that led up to it has finished and nothing after it has started, so
     that hold *is* the beat you're on rather than the one you just left. */
  const beatAt = (tl) => stopsOf(tl).filter((s) => s < tl.time() - EPS).length + 1;

  /* Enter a scene from the top.

     A scene whose first hold sits at zero opens on an empty stage and
     waits. That needs seeking rather than restarting: GSAP skips a pause
     the playhead is already sitting on - it has to, or you could never
     resume from one - so restart() would run straight through it. */
  function startScene(tl) {
    const first = stopsOf(tl)[0];
    if (first !== undefined && first <= EPS) seek(tl, 0);
    else tl.restart();
  }

  let hudCache = "";

  function syncHud() {
    const slide = slides[current];
    if (!slide) return;
    const tl = slide.tl;
    scrub.value = tl.progress() * 1000;
    const stops = stopsOf(tl);
    const name = slide.scene.label ?? slide.scene.id;
    const text = stops.length ? `${name}  ·  ${beatAt(tl)}/${stops.length + 1}` : name;
    if (text !== hudCache) {
      label.textContent = text;
      hudCache = text;
    }
  }

  function go(index, direction = 1) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    openSpeedMenu(false);
    // Clamped at either end: nothing moves, but the HUD still has to agree
    // with where the playhead actually is.
    if (index === current) return syncHud();

    if (current >= 0) {
      slides[current].tl.pause();
      slides[current].svg.style("display", "none");
    }

    const slide = slides[index];
    ensure(slide);
    slide.svg.style("display", "block");
    current = index;

    // Forward is a performance, so it plays. Backward is almost always a
    // "wait, go back to that chart", so it lands on the finished frame.
    slide.tl.timeScale(SPEEDS[speedIndex]);
    if (direction < 0) seek(slide.tl, slide.tl.duration());
    else startScene(slide.tl);

    position.textContent = `${index + 1} / ${slides.length}`;
    dots.querySelectorAll(".dk-dot").forEach((d, i) => d.classList.toggle("on", i === index));
    syncHud();
    opts.onSlide?.(slide.scene, index);
  }

  /* Forward: release the next hold, or move on if the scene has none left. */
  function next() {
    const tl = slides[current].tl;
    const ahead = stopsOf(tl).find((s) => s > tl.time() + EPS);

    // Mid-animation, snap to where it was heading rather than make the room
    // wait out a tween the presenter has already talked past.
    if (tl.isActive()) {
      seek(tl, ahead === undefined ? tl.duration() : ahead);
      syncHud();
      return;
    }
    if (ahead !== undefined || !finished(tl)) {
      tl.play();
      return;
    }
    go(current + 1, 1);
  }

  /* Back: step to the previous hold, or to the previous scene's last frame. */
  function prev() {
    const tl = slides[current].tl;
    const back = stopsOf(tl).filter((s) => s < tl.time() - EPS).pop();
    if (back !== undefined) {
      seek(tl, back);
      syncHud();
      return;
    }
    go(current - 1, -1);
  }

  const replay = () => startScene(slides[current].tl);

  /* Presenting mode: drop the HUD and give its height back to the slide.

     The arrow keys still work with the controls hidden, which is the point
     - the deck is being driven from a clicker at that stage, not from the
     buttons. `h` toggles and Escape always restores, so there's a way back
     even though the button that says so is the thing that just
     disappeared. */
  function toggleControls(force) {
    const bare = mount.classList.toggle("bare", force);
    hideButton.textContent = bare ? "Show" : "Hide";
  }

  /* Speed menu.

     Nine speeds is too many to cycle through one click at a time, so they
     get a list. Built from SPEEDS rather than written into the markup, so
     adding a speed is a one-line change in one place. */
  const speedOptions = SPEEDS.map((value, i) => {
    const option = html("button", "", { type: "button", textContent: `${value}x` });
    option.setAttribute("role", "option");
    option.addEventListener("click", () => { setSpeed(i); openSpeedMenu(false); });
    speedList.appendChild(option);
    return option;
  });

  function setSpeed(index) {
    speedIndex = index;
    speedButton.textContent = `${SPEEDS[speedIndex]}x`;
    speedOptions.forEach((o, i) => o.classList.toggle("on", i === speedIndex));
    // Guarded so the initial call can mark the default before any slide has
    // been built; go() applies the speed itself on entry.
    if (current >= 0) slides[current].tl.timeScale(SPEEDS[speedIndex]);
  }

  const speedMenuOpen = () => !speedList.hidden;

  function openSpeedMenu(force) {
    const open = force === undefined ? speedList.hidden : force;
    speedList.hidden = !open;
    speedButton.setAttribute("aria-expanded", String(open));
  }

  scrub.addEventListener("input", () => {
    slides[current].tl.pause().progress(scrub.value / 1000);
    syncHud();
  });

  // Anywhere else closes it, including on the slide itself.
  document.addEventListener("click", (event) => {
    if (!speedMenu.contains(event.target)) openSpeedMenu(false);
  });

  const keys = {
    ArrowRight: next, PageDown: next, " ": next,
    ArrowLeft: prev, PageUp: prev,
    r: replay, R: replay,
    f: () => document.documentElement.requestFullscreen?.(),
    // The menu lives in the HUD, so asking for it while the HUD is hidden
    // has to bring the HUD back rather than open something invisible.
    s: () => { toggleControls(false); openSpeedMenu(); },
    h: () => toggleControls(),
    H: () => toggleControls(),
    // One Escape, one thing: dismiss the menu if it's up, otherwise fall
    // through to restoring the controls.
    Escape: () => (speedMenuOpen() ? openSpeedMenu(false) : toggleControls(false)),
    Home: () => go(0, -1),
    End: () => go(slides.length - 1, 1),
  };

  window.addEventListener("keydown", (event) => {
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  });

  /* Where the deck currently is: which scene, which beat, and the live
     timeline behind it. Handy from the console when cutting a talk. */
  const state = () => {
    const tl = slides[current].tl;
    const stops = stopsOf(tl);
    return {
      index: current,
      scene: slides[current].scene.id,
      beat: beatAt(tl),
      beats: stops.length + 1,
      stops,
      tl,
    };
  };

  /* Deep links: ?slide=3 opens on the third slide, and &frame=end opens on
     its finished state rather than playing it in.

     Worth having for the same reason backwards navigation lands on the
     last frame - most links to a deck are somebody saying "look at this
     chart", not "watch this from the top". It's also the only practical
     way to screenshot a scene. */
  const params = new URLSearchParams(location.search);
  const asked = Number(params.get("slide"));
  const opening = Number.isFinite(asked) && asked > 0 ? asked - 1 : start;

  setSpeed(speedIndex);
  go(opening, params.get("frame") === "end" ? -1 : 1);
  return { go, next, prev, replay, state, setSpeed, slides };
}
