import { test } from "node:test";
import assert from "node:assert/strict";
import { nowState, focusCourse, isTonight, type BellConfig } from "../lib/now.ts";

// A fixed schedule so these tests don't change when config/bells.ts does.
// November 2026 is CST (UTC-6): 08:45 local = 14:45Z.
const cfg: BellConfig = {
  timezone: "America/Chicago",
  schoolEnds: "16:00",
  schedules: {
    regular: [
      { period: "1", start: "08:30", end: "09:20", course: "Pre-Calc" },
      { period: "2", start: "09:25", end: "10:15", course: "AP Chinese" },
      { period: "Lunch", start: "10:15", end: "10:50", course: null },
      { period: "3", start: "10:55", end: "11:45", course: "Chemistry" },
    ],
    a: [{ period: "1", start: "09:00", end: "10:00", course: "Debate" }],
    b: [{ period: "1", start: "09:00", end: "10:00", course: "AP Physics 1" }],
    late: [{ period: "1", start: "10:00", end: "11:00", course: "Debate" }],
  },
  // A/B rotation: odd day-of-month = A, even = B (for the test only).
  dayType: (d) => (d.getUTCDate() === 11 || d.getUTCDate() === 12 ? (d.getUTCDate() % 2 ? "a" : "b") : "regular"),
  overrides: { "2026-11-13": "none", "2026-11-14": "late" },
};

const at = (iso: string) => new Date(iso);

test("in a period: the current class, with the period's bounds", () => {
  const s = nowState(at("2026-11-09T14:45:00Z"), cfg); // Mon 08:45
  assert.equal(s.kind, "in_class");
  assert.equal(focusCourse(s), "Pre-Calc");
  if (s.kind === "in_class") {
    assert.equal(s.period.endsAt.toISOString(), "2026-11-09T15:20:00.000Z");
    assert.equal(s.next?.course, "AP Chinese");
  }
});

test("period boundaries: start is inclusive, end is exclusive", () => {
  assert.equal(focusCourse(nowState(at("2026-11-09T14:30:00Z"), cfg)), "Pre-Calc"); // 08:30
  const s = nowState(at("2026-11-09T15:20:00Z"), cfg); // 09:20
  assert.equal(s.kind, "passing");
});

test("passing period: shows the next class", () => {
  const s = nowState(at("2026-11-09T15:22:00Z"), cfg); // 09:22
  assert.equal(s.kind, "passing");
  assert.equal(focusCourse(s), "AP Chinese");
  if (s.kind === "passing") assert.equal(Math.round((s.next.startsAt.getTime() - Date.parse("2026-11-09T15:22:00Z")) / 60000), 3);
});

test("lunch (a course-less period) behaves like passing to the next class", () => {
  const s = nowState(at("2026-11-09T16:30:00Z"), cfg); // 10:30
  assert.equal(s.kind, "passing");
  assert.equal(focusCourse(s), "Chemistry");
});

test("before school: Tonight view, unless first bell is within 10 minutes", () => {
  const early = nowState(at("2026-11-09T13:00:00Z"), cfg); // 07:00
  assert.equal(early.kind, "before_school");
  assert.ok(isTonight(early));
  const close = nowState(at("2026-11-09T14:25:00Z"), cfg); // 08:25
  assert.equal(close.kind, "passing");
  assert.equal(focusCourse(close), "Pre-Calc");
});

test("after school: after the last class", () => {
  const s = nowState(at("2026-11-09T18:00:00Z"), cfg); // 12:00
  assert.equal(s.kind, "after_school");
  assert.ok(isTonight(s));
  assert.equal(focusCourse(s), null);
  assert.equal(nowState(at("2026-11-10T03:00:00Z"), cfg).kind, "after_school"); // 21:00 Mon
});

test("weekend", () => {
  assert.equal(nowState(at("2026-11-08T16:00:00Z"), cfg).kind, "weekend"); // Sun 10:00
  assert.equal(nowState(at("2026-11-07T16:00:00Z"), cfg).kind, "weekend"); // Sat 10:00
});

test("override day: 'none' is a day off", () => {
  const s = nowState(at("2026-11-13T15:00:00Z"), cfg); // Fri 09:00
  assert.equal(s.kind, "no_school");
  assert.ok(isTonight(s));
});

test("override day: a named schedule replaces the normal one, even on a weekend", () => {
  const s = nowState(at("2026-11-14T16:30:00Z"), cfg); // Sat 10:30, "late" schedule
  assert.equal(s.kind, "in_class");
  assert.equal(focusCourse(s), "Debate");
});

test("A/B rotation picks the schedule from dayType", () => {
  assert.equal(focusCourse(nowState(at("2026-11-11T15:30:00Z"), cfg)), "Debate"); // Wed (A) 09:30
  assert.equal(focusCourse(nowState(at("2026-11-12T15:30:00Z"), cfg)), "AP Physics 1"); // Thu (B) 09:30
});

test("local midnight boundary uses the school's timezone, not UTC", () => {
  // 23:30 Sunday in Chicago is 05:30Z Monday: still the weekend locally.
  assert.equal(nowState(at("2026-11-09T05:30:00Z"), cfg).kind, "weekend");
});
