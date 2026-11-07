"use server";

import { classify } from "@/lib/notion/client";
import { createTask, trashTask, updateTask } from "@/lib/notion/write";
import { demoWrites } from "@/lib/demo";
import { getNotionContext, isDemo, readSources } from "@/lib/session";
import { PRIORITIES, STATUS, TASK_TYPES, type NewTask, type NotionDate, type Task, type TaskPatch, type WriteResult } from "@/lib/types";

// All writes go through these Server Actions. Inputs are validated here
// because a Server Action is a public endpoint. "Scheduled For" and
// "Calendar Event" can't be expressed in TaskPatch, and lib/notion/write
// refuses them again as a second guard.

const STATUSES = new Set<string>(Object.values(STATUS).flat());
const ID = /^[0-9a-f-]{32,36}$|^t-[\w-]+$/i;

function cleanDate(d: unknown): NotionDate {
  if (d === null) return null;
  if (!d || typeof d !== "object") throw new Error("bad date");
  const start = (d as { start?: unknown }).start;
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(start)) throw new Error("bad date");
  return { start, end: null };
}

function cleanPatch(p: TaskPatch): TaskPatch {
  const out: TaskPatch = {};
  if (p.title !== undefined) {
    const t = String(p.title).trim();
    if (!t) throw new Error("Title can't be empty");
    out.title = t.slice(0, 2000);
  }
  if (p.due !== undefined) out.due = cleanDate(p.due);
  if (p.status !== undefined) {
    if (!STATUSES.has(p.status)) throw new Error("bad status");
    out.status = p.status;
  }
  if (p.type !== undefined) {
    if (p.type !== null && !TASK_TYPES.includes(p.type)) throw new Error("bad type");
    out.type = p.type;
  }
  if (p.minutes !== undefined) {
    if (p.minutes !== null && (!Number.isFinite(p.minutes) || p.minutes < 0 || p.minutes > 10_000)) throw new Error("bad minutes");
    out.minutes = p.minutes === null ? null : Math.round(p.minutes);
  }
  if (p.priority !== undefined) {
    if (p.priority !== null && !PRIORITIES.includes(p.priority)) throw new Error("bad priority");
    out.priority = p.priority;
  }
  if (p.courseId !== undefined) {
    if (p.courseId !== null && !ID.test(p.courseId) && !p.courseId.startsWith("c-")) throw new Error("bad course");
    out.courseId = p.courseId;
  }
  return out;
}

async function withNotion<T>(run: (ctx: Extract<Awaited<ReturnType<typeof getNotionContext>>, { ok: true }>, assignments: string) => Promise<T>): Promise<WriteResult<T>> {
  try {
    const ctx = await getNotionContext();
    if (!ctx.ok) return { ok: false, message: "Your Notion session expired.", reauth: true };
    const sources = await readSources(ctx.workspaceId);
    if (!sources) return { ok: false, message: "Dial isn't connected to your tracker yet.", reauth: true };
    return { ok: true, value: await run(ctx, sources.assignments) };
  } catch (err) {
    const f = classify(err);
    return { ok: false, message: f.message, reauth: f.kind === "reauth" };
  }
}

async function demo<T>(run: () => Promise<T>): Promise<WriteResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Demo write failed" };
  }
}

export async function createTaskAction(input: NewTask): Promise<WriteResult<Task>> {
  let clean: NewTask;
  try {
    const p = cleanPatch({ title: input.title, due: input.due, type: input.type, minutes: input.minutes, priority: input.priority, courseId: input.courseId });
    if (!p.title || !p.courseId) throw new Error("A task needs a title and a class");
    clean = { title: p.title, courseId: p.courseId, due: p.due ?? null, type: p.type ?? null, minutes: p.minutes ?? null, priority: p.priority ?? "Medium" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (isDemo()) return demo(() => demoWrites.create(clean));
  return withNotion((ctx, ds) => createTask(ctx.notion, ds, clean));
}

export async function updateTaskAction(id: string, patch: TaskPatch): Promise<WriteResult<Task>> {
  let clean: TaskPatch;
  try {
    if (!ID.test(id)) throw new Error("bad id");
    clean = cleanPatch(patch);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (isDemo()) return demo(() => demoWrites.update(id, clean));
  return withNotion((ctx) => updateTask(ctx.notion, id, clean));
}

export async function trashTaskAction(id: string, trash = true): Promise<WriteResult<null>> {
  if (!ID.test(id)) return { ok: false, message: "bad id" };
  if (isDemo()) return demo(async () => (await demoWrites.trash(id, trash), null));
  return withNotion(async (ctx) => (await trashTask(ctx.notion, id, trash), null));
}
