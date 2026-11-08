// Timezone helpers built on Intl, so the server (UTC on Vercel) and the
// browser agree on "school time" without a date library.

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// formatToParts is the hot path of every due label and "now" check; the same
// handful of instants (now, start of today, each due date) repeat constantly.
const partsCache = new Map<string, ZonedParts>();

export function zonedParts(date: Date, tz: string): ZonedParts {
  const key = `${date.getTime()}|${tz}`;
  const hit = partsCache.get(key);
  if (hit) return hit;
  const z = computeParts(date, tz);
  if (partsCache.size > 500) partsCache.clear();
  partsCache.set(key, z);
  return z;
}

function computeParts(date: Date, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour % 24,
    minute: +p.minute,
    second: +p.second,
    weekday: WEEKDAYS[p.weekday],
  };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function offsetAt(date: Date, tz: string): number {
  const z = zonedParts(date, tz);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `tz` reads the given local time. */
export function fromZoned(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - offsetAt(new Date(guess), tz);
  // Second pass settles DST transitions.
  t = guess - offsetAt(new Date(t), tz);
  return new Date(t);
}

/** "YYYY-MM-DD" for the local date in `tz`. */
export function dateKey(date: Date, tz: string): string {
  const z = zonedParts(date, tz);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

/** Midnight (in tz) of the local day containing `date`, shifted by `days`. */
export function startOfDay(date: Date, tz: string, days = 0): Date {
  const z = zonedParts(date, tz);
  const shifted = new Date(Date.UTC(z.year, z.month - 1, z.day + days));
  return fromZoned(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), 0, 0, tz);
}

/** Monday 00:00 (in tz) of the week containing `date`. */
export function startOfWeek(date: Date, tz: string): Date {
  const { weekday } = zonedParts(date, tz);
  return startOfDay(date, tz, -((weekday + 6) % 7));
}

/** Minutes since local midnight. */
export function minutesOfDay(date: Date, tz: string): number {
  const z = zonedParts(date, tz);
  return z.hour * 60 + z.minute + z.second / 60;
}

/** "08:30" → 510 */
export function hm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Notion dates come as "2026-11-07" (all-day) or a full ISO datetime.
 * All-day dates are treated as due at 23:59 local time that day.
 */
export function dueInstant(start: string, tz: string): Date {
  if (start.length === 10) {
    const [y, m, d] = start.split("-").map(Number);
    return fromZoned(y, m, d, 23, 59, tz);
  }
  return new Date(start);
}
