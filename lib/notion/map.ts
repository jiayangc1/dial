import "server-only";
import type { PageObjectResponse } from "@notionhq/client";
import { A, C } from "./schema";
import { colorName } from "../colors";
import { PRIORITIES, TASK_TYPES, statusGroupOf, type Course, type NotionDate, type Priority, type Task, type TaskType } from "../types";

type Props = PageObjectResponse["properties"];
type Prop = Props[string];

function plain(p: Prop | undefined): string | null {
  if (!p) return null;
  if (p.type === "title") return p.title.map((t) => t.plain_text).join("") || null;
  if (p.type === "rich_text") return p.rich_text.map((t) => t.plain_text).join("") || null;
  return null;
}
function select(p: Prop | undefined): string | null {
  if (p?.type === "select") return p.select?.name ?? null;
  if (p?.type === "status") return p.status?.name ?? null;
  return null;
}
function date(p: Prop | undefined): NotionDate {
  if (p?.type !== "date" || !p.date) return null;
  return { start: p.date.start, end: p.date.end };
}
function url(p: Prop | undefined): string | null {
  return p?.type === "url" ? p.url : null;
}
function number(p: Prop | undefined): number | null {
  return p?.type === "number" ? p.number : null;
}
function relation(p: Prop | undefined): string[] {
  return p?.type === "relation" ? p.relation.map((r) => r.id) : [];
}
function oneOf<T extends string>(v: string | null, list: readonly T[]): T | null {
  return v && (list as readonly string[]).includes(v) ? (v as T) : null;
}

export function toCourse(page: PageObjectResponse): Course {
  const p = page.properties;
  return {
    id: page.id,
    name: plain(p[C.title]) ?? "Untitled class",
    instructor: plain(p[C.instructor]),
    color: colorName(select(p[C.color])),
    portalUrl: url(p[C.portal]),
    url: page.url,
  };
}

export function toTask(page: PageObjectResponse): Task {
  const p = page.properties;
  const status = select(p[A.status]) ?? "Not started";
  return {
    id: page.id,
    url: page.url,
    title: plain(p[A.title]) ?? "Untitled",
    courseIds: relation(p[A.course]),
    due: date(p[A.due]),
    status,
    statusGroup: statusGroupOf(status),
    type: oneOf<TaskType>(select(p[A.type]), TASK_TYPES),
    minutes: number(p[A.minutes]),
    priority: oneOf<Priority>(select(p[A.priority]), PRIORITIES),
    scheduledFor: date(p[A.scheduledFor]),
    calendarEvent: url(p[A.calendarEvent]),
    source: select(p[A.source]),
    lastEdited: page.last_edited_time,
  };
}
