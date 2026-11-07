// Quick-add parser: "worksheet 2.4 fri 30m quiz @chem !high" →
// { title: "worksheet 2.4", due: Fri, minutes: 30, type: "Test / Quiz", course, priority }.
// Pure and alias-free so node:test can import it directly.
import * as chrono from "chrono-node";
import { fromZoned, zonedParts } from "./time.ts";
import type { Priority, TaskType } from "./types.ts";

export type TokenKind = "date" | "minutes" | "type" | "priority" | "course";

export type Token = {
  kind: TokenKind;
  /** The exact text matched in the input. */
  text: string;
  start: number;
  end: number;
};

export type Parsed = {
  title: string;
  /** "YYYY-MM-DD" (all-day) or an ISO instant. */
  due: { start: string; end: null } | null;
  minutes: number | null;
  type: TaskType | null;
  priority: Priority | null;
  courseId: string | null;
  tokens: Token[];
};

export type ParseOptions = {
  now: Date;
  timezone: string;
  courses: Array<{ id: string; name: string }>;
  /** Token kinds the user dismissed: their text stays in the title. */
  ignore?: ReadonlySet<TokenKind>;
};

const TYPE_WORDS: Record<string, TaskType> = {
  quiz: "Test / Quiz",
  test: "Test / Quiz",
  exam: "Test / Quiz",
  midterm: "Test / Quiz",
  final: "Test / Quiz",
  hw: "Homework",
  homework: "Homework",
  project: "Project",
  reading: "Reading",
  study: "Study",
  other: "Other",
};

const PRIORITY: Record<string, Priority> = {
  "": "High",
  "!": "High",
  high: "High",
  hi: "High",
  h: "High",
  med: "Medium",
  medium: "Medium",
  m: "Medium",
  low: "Low",
  lo: "Low",
  l: "Low",
};

// Words left dangling once a date is pulled out: "essay due fri" → "essay".
const DANGLING = /(?:\s+(?:due|by|on|at|for|before))+\s*$/i;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Score how well `q` names a course. 0 = no match. */
function courseScore(q: string, name: string): number {
  const nq = norm(q);
  if (!nq) return 0;
  const n = norm(name);
  if (n === nq) return 100;
  const paren = name.match(/\(([^)]+)\)/)?.[1];
  if (paren && norm(paren) === nq) return 95;
  if (n.startsWith(nq)) return 80;
  const words = name.replace(/\([^)]*\)/g, " ").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.some((w) => norm(w).startsWith(nq) && w.length > 2)) return 70;
  const acronym = words.map((w) => w[0]).join("").toLowerCase();
  if (nq.length >= 2 && acronym.startsWith(nq)) return 60;
  return 0;
}

function bestCourse(q: string, courses: ParseOptions["courses"]) {
  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const c of courses) {
    const s = courseScore(q, c.name);
    if (!s) continue;
    if (!best || s > best.score) {
      best = { id: c.id, score: s };
      tie = false;
    } else if (s === best.score) tie = true;
  }
  return best ? { ...best, tie } : null;
}

// chrono doesn't know "tmr"/"tmrw" out of the box.
const parser = chrono.casual.clone();
parser.parsers.push({
  pattern: () => /\btmrw?\b|\btmrow\b|\btmw\b/i,
  extract: (context) => {
    const d = new Date(context.refDate.getTime() + 86_400_000);
    return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  },
});

export function parseQuickAdd(input: string, opts: ParseOptions): Parsed {
  const ignore = opts.ignore ?? new Set<TokenKind>();
  const tokens: Token[] = [];
  const taken = (s: number, e: number) => tokens.some((t) => s < t.end && e > t.start);
  const add = (kind: TokenKind, start: number, end: number) => {
    if (ignore.has(kind) || taken(start, end) || tokens.some((t) => t.kind === kind)) return false;
    tokens.push({ kind, text: input.slice(start, end), start, end });
    return true;
  };

  let courseId: string | null = null;
  let priority: Priority | null = null;
  let minutes: number | null = null;
  let type: TaskType | null = null;
  let due: Parsed["due"] = null;

  // @class (optionally two words: "@ap chinese")
  for (const m of input.matchAll(/(?<!\S)@([\p{L}\p{N}][\p{L}\p{N}-]*)(\s+[\p{L}\p{N}][\p{L}\p{N}-]*)?/gu)) {
    const one = bestCourse(m[1], opts.courses);
    const two = m[2] ? bestCourse(m[1] + m[2], opts.courses) : null;
    const useTwo = two && two.score >= 70 && (!one || two.score > one.score || one.tie);
    const pick = useTwo ? two : one;
    if (!pick || (pick.tie && !useTwo)) continue;
    const end = m.index + (useTwo ? m[0].length : 1 + m[1].length);
    if (add("course", m.index, end)) courseId = pick.id;
  }

  // !priority
  for (const m of input.matchAll(/(?<!\S)!(!|high|hi|h|medium|med|m|low|lo|l)?(?!\S)/gi)) {
    const p = PRIORITY[(m[1] ?? "").toLowerCase()];
    if (p && add("priority", m.index, m.index + m[0].length)) priority = p;
  }

  // Durations: 30m, 45 min, 1h, 1.5h, 1h30, 1h 30m, 2 hours
  for (const m of input.matchAll(
    /(?<![\w.])(?:(\d+(?:\.\d+)?)\s?(?:h|hr|hrs|hour|hours)(?:\s?(\d{1,2})\s?(?:m|min|mins)?)?|(\d{1,3})\s?(?:m|min|mins|minute|minutes))(?![\w.])/gi,
  )) {
    const value = m[3] ? Number(m[3]) : Math.round(Number(m[1]) * 60) + (m[2] ? Number(m[2]) : 0);
    if (value > 0 && value <= 24 * 60 && add("minutes", m.index, m.index + m[0].length)) minutes = value;
  }

  // Dates. Run chrono on the text with the tokens above blanked out (same
  // length, so offsets still line up). The reference is the school-local
  // wall clock expressed as UTC, so results come back as local components.
  if (!ignore.has("date")) {
    let masked = input;
    for (const t of tokens) masked = masked.slice(0, t.start) + " ".repeat(t.end - t.start) + masked.slice(t.end);
    const z = zonedParts(opts.now, opts.timezone);
    const ref = { instant: new Date(Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute)), timezone: 0 };
    for (const r of parser.parse(masked, ref, { forwardDate: true })) {
      const text = r.text.trim();
      // "2.4" or "3.1" in a title is a section number, not a date. Bare numbers too.
      if (/^\d+(?:\.\d+)?$/.test(text) || /^(?:now|second|sec|a|an)$/i.test(text)) continue;
      // "last week's quiz" is a title, not a due date: quick-add never sets past dates.
      if (/^(?:last|past|previous|yesterday)\b|\bago$/i.test(text)) continue;
      const start = r.index + r.text.indexOf(text);
      if (!add("date", start, start + text.length)) continue;
      const c = r.start;
      const y = c.get("year")!;
      const mo = c.get("month")!;
      const d = c.get("day")!;
      if (c.isCertain("hour")) {
        due = { start: fromZoned(y, mo, d, c.get("hour")!, c.get("minute") ?? 0, opts.timezone).toISOString(), end: null };
      } else {
        due = { start: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, end: null };
      }
      break;
    }
  }

  // Type words. "#quiz" is always metadata. A bare "quiz" is removed from the
  // title only when it trails other metadata ("ws 2.4 fri 30m quiz");
  // otherwise it just sets the type ("Unit 3 test" keeps its name).
  let keepTypeInTitle = false;
  if (!ignore.has("type")) {
    const firstMeta = tokens.length ? Math.min(...tokens.map((t) => t.start)) : Infinity;
    for (const m of input.matchAll(/(?<!\S)(#?)([a-z]+)(?![\p{L}\p{N}])/giu)) {
      const t = TYPE_WORDS[m[2].toLowerCase()];
      if (!t || taken(m.index, m.index + m[0].length) || type) continue;
      const hashed = m[1] === "#";
      if (!hashed && m.index < firstMeta) {
        type = t;
        keepTypeInTitle = true;
        continue;
      }
      if (add("type", m.index, m.index + m[0].length)) type = t;
    }
  }

  // Title: input minus the token spans.
  const spans = [...tokens].sort((a, b) => a.start - b.start);
  let title = "";
  let cursor = 0;
  for (const t of spans) {
    title += input.slice(cursor, t.start) + " ";
    cursor = t.end;
  }
  title += input.slice(cursor);
  title = title.replace(/\s+/g, " ").trim().replace(DANGLING, "").replace(/[\s,;:–—-]+$/, "").trim();
  if (!title && keepTypeInTitle === false && type) title = Object.entries(TYPE_WORDS).find(([, v]) => v === type)?.[0] ?? "";

  tokens.sort((a, b) => a.start - b.start);
  return { title, due, minutes, type, priority, courseId, tokens };
}
