import "server-only";
import { classify } from "./notion/client";
import { readCourses, readTasks } from "./notion/read";
import { demoSnapshot } from "./demo";
import { fromZoned } from "./time";
import { timezone } from "@/config/bells";
import { getNotionContext, isDemo, readSources } from "./session";
import type { Snapshot } from "./types";

export type SnapshotResult =
  | { ok: true; snapshot: Snapshot; requestedAt: number }
  | { ok: false; reason: "signed_out" | "reauth" | "onboarding" }
  | { ok: false; reason: "notion"; message: string };

/** `?now=YYYY-MM-DDTHH:MM` (school-local) → the instant it names, or null. */
export function parseNowParam(raw: string | null | undefined): { at: Date; key: string } | null {
  const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? { at: fromZoned(+m[1], +m[2], +m[3], +m[4], +m[5], timezone), key: m[0] } : null;
}

/**
 * Everything the app shell needs: enrolled courses and open + done-this-week
 * tasks, fetched in parallel through the per-token rate-limit queue. Shared
 * by the server-rendered first view and the polling `/api/data` route.
 */
export async function loadSnapshot(opts: { scenario?: string | null; now?: string | null } = {}): Promise<SnapshotResult> {
  // Before any read: a poll that started before a write landed must not overwrite it.
  const requestedAt = Date.now();
  if (isDemo()) {
    // Demo only: fixtures are generated relative to ?now=.
    const n = parseNowParam(opts.now);
    return { ok: true, snapshot: demoSnapshot(opts.scenario ?? null, n?.at ?? new Date(), n?.key ?? null), requestedAt };
  }

  const ctx = await getNotionContext();
  if (!ctx.ok) return { ok: false, reason: ctx.reason };

  const sources = await readSources(ctx.workspaceId);
  if (!sources) return { ok: false, reason: "onboarding" };

  try {
    const [courses, tasks] = await Promise.all([readCourses(ctx.notion, sources.courses), readTasks(ctx.notion, sources.assignments)]);
    return {
      ok: true,
      snapshot: {
        user: { name: ctx.name, image: ctx.image, workspace: ctx.workspace },
        courses,
        tasks,
        fetchedAt: new Date().toISOString(),
        demo: false,
      },
      requestedAt,
    };
  } catch (err) {
    const f = classify(err);
    if (f.kind === "reauth") return { ok: false, reason: "reauth" };
    if (f.kind === "not_found") return { ok: false, reason: "onboarding" };
    return { ok: false, reason: "notion", message: f.message };
  }
}
