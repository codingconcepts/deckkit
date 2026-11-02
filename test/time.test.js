/* The time parser is the one piece of deckkit with no visual tell.

   Everything else you check by looking at a slide. A position that parses
   to the wrong thing produces a deck that plays, looks plausible, and is a
   fifth of a second out - so this one gets assertions. */

import test from "node:test";
import assert from "node:assert/strict";

import { secs, at, timing } from "../src/core/time.js";

test("secs: numbers are seconds", () => {
  assert.equal(secs(1.5), 1.5);
  assert.equal(secs(0), 0);
  assert.equal(secs(-0.4), -0.4);
});

test("secs: strings carry a unit", () => {
  assert.equal(secs("1.5s"), 1.5);
  assert.equal(secs("150ms"), 0.15);
  assert.equal(secs("-400ms"), -0.4);
  assert.equal(secs(" 700 ms "), 0.7);
  assert.equal(secs(".5s"), 0.5);
  assert.equal(secs("2"), 2);          // bare string, still seconds
});

test("secs: anything unparseable comes back untouched", () => {
  assert.equal(secs("myLabel"), "myLabel");
  assert.equal(secs(undefined), undefined);
});

test("at: relative to the end of the timeline", () => {
  assert.equal(at("150ms"), "+=0.15");
  assert.equal(at("1.5s"), "+=1.5");
  assert.equal(at(0.25), "+=0.25");
  assert.equal(at("-400ms"), "-=0.4");
  assert.equal(at(-0.4), "-=0.4");
});

test("at: relative to the previous tween", () => {
  assert.equal(at("<"), "<");
  assert.equal(at("<300ms"), "<0.3");
  assert.equal(at(">200ms"), ">0.2");
  assert.equal(at(">"), ">");
});

test("at: @ is the absolute escape, and returns a number", () => {
  assert.equal(at("@2s"), 2);
  assert.equal(at("@1500ms"), 1.5);
});

test("at: GSAP's own syntax passes through untouched", () => {
  assert.equal(at("+=0.15"), "+=0.15");
  assert.equal(at("-=0.4"), "-=0.4");
  assert.equal(at("dk3+=0.5"), "dk3+=0.5");
});

test("at: a bare label passes through", () => {
  assert.equal(at("intro"), "intro");
  // The reason mark() doesn't prefix its labels with "@": this would
  // otherwise parse as an absolute position.
  assert.equal(at("dk1"), "dk1");
});

test("at: nothing in, nothing out", () => {
  assert.equal(at(undefined), undefined);
  assert.equal(at(null), undefined);
  assert.equal(at("  "), undefined);
});

test("at is idempotent, because a parsed position can be parsed again", () => {
  for (const spec of ["150ms", "-400ms", "<300ms", "+=0.15", "dk2"]) {
    assert.deepEqual(at(at(spec)), at(spec), spec);
  }
});

test("timing: durations inside a step's options", () => {
  assert.deepEqual(
    timing({ duration: "700ms", stagger: "28ms", ease: "none", opacity: 0 }),
    { duration: 0.7, stagger: 0.028, ease: "none", opacity: 0 },
  );
});

test("timing: an advanced stagger object is left alone", () => {
  const stagger = { each: 0.1, from: "center" };
  assert.deepEqual(timing({ stagger }).stagger, stagger);
});
