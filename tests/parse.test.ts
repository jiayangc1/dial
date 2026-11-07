import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd, type ParseOptions } from "../lib/parse.ts";

const courses = [
  { id: "precalc", name: "Pre-Calc" },
  { id: "chinese", name: "AP Chinese" },
  { id: "whap", name: "AP World History (WHAP)" },
  { id: "chem", name: "Chemistry" },
  { id: "physics", name: "AP Physics 1" },
  { id: "cs", name: "Computer Science 1A" },
  { id: "debate", name: "Debate" },
];

// Monday 9 November 2026, 10:00 in Chicago (CST, UTC-6).
const opts: ParseOptions = { now: new Date("2026-11-09T16:00:00Z"), timezone: "America/Chicago", courses };
const p = (s: string, o: Partial<ParseOptions> = {}) => parseQuickAdd(s, { ...opts, ...o });

test("the spec example: worksheet 2.4 fri 30m quiz", () => {
  const r = p("worksheet 2.4 fri 30m quiz");
  assert.equal(r.title, "worksheet 2.4");
  assert.deepEqual(r.due, { start: "2026-11-13", end: null });
  assert.equal(r.minutes, 30);
  assert.equal(r.type, "Test / Quiz");
  assert.deepEqual(
    r.tokens.map((t) => t.kind),
    ["date", "minutes", "type"],
  );
});

test("section numbers are not dates", () => {
  const r = p("Read 3.1 notes");
  assert.equal(r.title, "Read 3.1 notes");
  assert.equal(r.due, null);
});

test("a leading type word stays in the title but still sets the type", () => {
  const r = p("Unit 3 test tomorrow");
  assert.equal(r.title, "Unit 3 test");
  assert.equal(r.type, "Test / Quiz");
  assert.equal(r.due?.start, "2026-11-10");
});

test("#hashtag type is always removed", () => {
  const r = p("chapter 4 #reading");
  assert.equal(r.title, "chapter 4");
  assert.equal(r.type, "Reading");
});

test("durations: minutes, hours, decimals, and h+m combos", () => {
  assert.equal(p("lab 45 min").minutes, 45);
  assert.equal(p("essay 2h").minutes, 120);
  assert.equal(p("essay 1.5h").minutes, 90);
  assert.equal(p("essay 1h30").minutes, 90);
  assert.equal(p("essay 1h 30m").minutes, 90);
  assert.equal(p("essay 1h 30m").title, "essay");
});

test("@class sends the task to another class", () => {
  assert.equal(p("DBQ outline @whap").courseId, "whap");
  assert.equal(p("lab report @chem").courseId, "chem");
  assert.equal(p("lab @physics").courseId, "physics");
  assert.equal(p("loops lab @cs").courseId, "cs");
  assert.equal(p("lab report @chem").title, "lab report");
});

test("@class with two words disambiguates shared prefixes", () => {
  const r = p("vocab @ap chinese fri");
  assert.equal(r.courseId, "chinese");
  assert.equal(r.title, "vocab");
});

test("an ambiguous or unknown @class is left alone", () => {
  assert.equal(p("thing @ap").courseId, null);
  assert.equal(p("email @teacher").courseId, null);
  assert.equal(p("email @teacher").title, "email @teacher");
});

test("priority markers", () => {
  assert.equal(p("study !").priority, "High");
  assert.equal(p("study !!").priority, "High");
  assert.equal(p("study !low").priority, "Low");
  assert.equal(p("study !low").title, "study");
  assert.equal(p("wow! great").priority, null);
});

test("times make a datetime due in the school timezone; dangling 'due' is dropped", () => {
  const r = p("essay due fri at 3pm");
  assert.equal(r.title, "essay");
  assert.equal(r.due?.start, "2026-11-13T21:00:00.000Z");
});

test("tmr / tmrw shorthand", () => {
  assert.equal(p("ws 2.4 tmrw").due?.start, "2026-11-10");
  assert.equal(p("ws 2.4 tmr").title, "ws 2.4");
});

test("absolute dates", () => {
  assert.equal(p("project nov 20").due?.start, "2026-11-20");
  assert.equal(p("project 11/20").due?.start, "2026-11-20");
});

test("dismissed chips put their text back in the title", () => {
  const r = p("worksheet fri 30m", { ignore: new Set(["date"]) });
  assert.equal(r.due, null);
  assert.equal(r.title, "worksheet fri");
  assert.equal(r.minutes, 30);
});

test("plain text passes through untouched", () => {
  const r = p("Correct last week's quiz corrections");
  assert.equal(r.title, "Correct last week's quiz corrections");
  assert.equal(r.due, null);
  assert.equal(r.minutes, null);
});
