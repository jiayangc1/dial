"use client";

import { createTaskAction, trashTaskAction, updateTaskAction } from "@/app/task-actions";
import { statusGroupOf, type NewTask, type Task, type TaskPatch, type WriteResult } from "../types";

// Optimistic task state. The visible list is `server` with every pending op
// replayed on top, so UI updates land in the same frame as the tap (<100ms)
// no matter how slow Notion is. Ops run one at a time (Notion's rate limit
// makes parallel writes pointless, and it keeps create → edit ordering
// trivially correct). Offline, ops are queued in localStorage and flushed
// when the connection returns.

export type ClientTask = Task & { key: string; pending?: boolean };

type OpBase = { opId: string; queued?: boolean };
export type Op =
  | (OpBase & { kind: "create"; temp: ClientTask; input: NewTask })
  | (OpBase & { kind: "update"; taskId: string; patch: TaskPatch })
  | (OpBase & { kind: "trash"; taskId: string; trash: boolean });

type Listener = () => void;
export type StoreEvents = {
  onError: (message: string, retry: () => void) => void;
  onReauth: () => void;
  /** A write landed: time to revalidate from Notion. */
  onSynced: () => void;
};

const QUEUE_KEY = "dial.queue.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function patchTask(t: ClientTask, patch: TaskPatch): ClientTask {
  const next: ClientTask = { ...t };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.due !== undefined) next.due = patch.due;
  if (patch.status !== undefined) {
    next.status = patch.status;
    next.statusGroup = statusGroupOf(patch.status);
  }
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.minutes !== undefined) next.minutes = patch.minutes;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.courseId !== undefined) next.courseIds = patch.courseId ? [patch.courseId] : [];
  return next;
}

export class TaskStore {
  private server: ClientTask[] = [];
  private ops: Op[] = [];
  private listeners = new Set<Listener>();
  private running = false;
  private lastWriteAt = 0;
  /** Real Notion id → stable client key, so a created row never remounts. */
  private keys = new Map<string, string>();
  /** Temp id of a create → real id once Notion answers. */
  private realIds = new Map<string, string>();
  private snapshot: ClientTask[] = [];
  events: StoreEvents = { onError: () => {}, onReauth: () => {}, onSynced: () => {} };

  /**
   * `initial` is the server-rendered snapshot, so the first client render
   * matches the HTML. The offline queue lives in localStorage, which the
   * server can't see: call `loadQueue()` after mount.
   */
  constructor(initial: Task[] = []) {
    this.server = initial.map((t) => this.withKey(t));
    this.recompute();
  }

  loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) this.ops = [...(JSON.parse(raw) as Op[]).map((o) => ({ ...o, queued: true })), ...this.ops.filter((o) => !o.queued)];
    } catch {}
    if (this.ops.length) this.recompute();
  }

  setEvents(e: StoreEvents) {
    this.events = e;
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snapshot;
  get queuedCount() {
    return this.ops.filter((o) => o.queued).length;
  }

  private recompute() {
    let tasks = this.server;
    for (const op of this.ops) {
      if (op.kind === "create") tasks = [...tasks, { ...op.temp, pending: true }];
      else {
        const id = this.realIds.get(op.taskId) ?? op.taskId;
        if (op.kind === "update") tasks = tasks.map((t) => (t.id === id || t.key === op.taskId ? { ...patchTask(t, op.patch), pending: true } : t));
        else if (op.trash) tasks = tasks.filter((t) => t.id !== id && t.key !== op.taskId);
      }
    }
    this.snapshot = tasks;
    for (const l of this.listeners) l();
  }

  private persist() {
    try {
      const queued = this.ops.filter((o) => o.queued);
      if (queued.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queued));
      else localStorage.removeItem(QUEUE_KEY);
    } catch {}
  }

  private withKey(t: Task): ClientTask {
    return { ...t, key: this.keys.get(t.id) ?? t.id };
  }

  /** Fresh data from a poll. Ignored if it was requested before our last write landed. */
  setServer(tasks: Task[], requestedAt = Date.now()) {
    if (requestedAt < this.lastWriteAt) return;
    this.server = tasks.map((t) => this.withKey(t));
    this.recompute();
  }

  // ── Public operations ────────────────────────────────────────────────
  create(input: NewTask): ClientTask {
    const key = `tmp-${uid()}`;
    const temp: ClientTask = {
      key,
      id: key,
      url: "",
      title: input.title,
      courseIds: [input.courseId],
      due: input.due,
      status: "Not started",
      statusGroup: "todo",
      type: input.type,
      minutes: input.minutes,
      priority: input.priority ?? "Medium",
      scheduledFor: null,
      calendarEvent: null,
      source: "Me",
      lastEdited: new Date().toISOString(),
    };
    this.push({ opId: uid(), kind: "create", temp, input });
    return temp;
  }
  update(taskKey: string, patch: TaskPatch) {
    this.push({ opId: uid(), kind: "update", taskId: this.resolve(taskKey), patch });
  }
  trash(taskKey: string, trash = true) {
    this.push({ opId: uid(), kind: "trash", taskId: this.resolve(taskKey), trash });
  }
  /** Bring back a task removed by a trash op (undo for delete). */
  restore(task: ClientTask) {
    if (!this.server.some((t) => t.id === task.id)) this.server = [...this.server, task];
    this.push({ opId: uid(), kind: "trash", taskId: task.id, trash: false });
  }

  private resolve(keyOrId: string) {
    const t = this.snapshot.find((x) => x.key === keyOrId || x.id === keyOrId);
    return t?.id ?? keyOrId;
  }

  private push(op: Op) {
    if (typeof navigator !== "undefined" && !navigator.onLine) op.queued = true;
    this.ops.push(op);
    this.persist();
    this.recompute();
    void this.drain();
  }

  /** Called on the `online` event. */
  flush() {
    for (const o of this.ops) o.queued = false;
    this.persist();
    this.recompute();
    void this.drain();
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const op = this.ops.find((o) => !o.queued);
        if (!op) break;
        let res: WriteResult<unknown>;
        try {
          res = await this.execute(op);
        } catch {
          // Network failure: park everything until we're back online.
          for (const o of this.ops) o.queued = true;
          this.persist();
          this.recompute();
          break;
        }
        this.ops = this.ops.filter((o) => o !== op);
        this.lastWriteAt = Date.now();
        if (res.ok) {
          this.commit(op, res.value);
          if (!this.ops.some((o) => !o.queued)) this.events.onSynced();
        }
        else if (res.reauth) {
          this.persist();
          this.events.onReauth();
          return;
        } else {
          // Roll back (the op is gone from the replay) and offer a retry.
          const retry = () => {
            const { opId: _drop, ...rest } = op;
            void _drop;
            this.push({ ...rest, opId: uid(), queued: false } as Op);
          };
          this.events.onError(res.message, retry);
        }
        this.persist();
        this.recompute();
      }
    } finally {
      this.running = false;
    }
  }

  private execute(op: Op): Promise<WriteResult<unknown>> {
    if (op.kind === "create") return createTaskAction(op.input);
    const id = this.realIds.get(op.taskId) ?? op.taskId;
    if (id.startsWith("tmp-")) return Promise.resolve({ ok: false, message: "That task never reached Notion." });
    if (op.kind === "update") return updateTaskAction(id, op.patch);
    return trashTaskAction(id, op.trash);
  }

  private commit(op: Op, value: unknown) {
    if (op.kind === "create") {
      const task = value as Task;
      this.keys.set(task.id, op.temp.key);
      this.realIds.set(op.temp.key, task.id);
      this.server = [...this.server, this.withKey(task)];
    } else if (op.kind === "update") {
      const task = value as Task;
      this.server = this.server.map((t) => (t.id === task.id ? this.withKey(task) : t));
    } else if (op.trash) {
      const id = this.realIds.get(op.taskId) ?? op.taskId;
      this.server = this.server.filter((t) => t.id !== id);
    }
  }
}
