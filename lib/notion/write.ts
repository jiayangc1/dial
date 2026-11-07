import "server-only";
import { isFullPage, type Client } from "@notionhq/client";
import type { CreatePageParameters } from "@notionhq/client";
import { A, BOT_OWNED } from "./schema";
import { toTask } from "./map";
import type { Task, TaskPatch, NewTask } from "../types";

type Properties = NonNullable<CreatePageParameters["properties"]>;

/** Translate a patch to Notion properties. Bot-owned properties can't be expressed. */
export function toProperties(patch: TaskPatch): Properties {
  const props: Properties = {};
  if (patch.title !== undefined) props[A.title] = { title: [{ text: { content: patch.title.slice(0, 2000) } }] };
  if (patch.due !== undefined) props[A.due] = { date: patch.due ? { start: patch.due.start } : null };
  if (patch.status !== undefined) props[A.status] = { status: { name: patch.status } };
  if (patch.type !== undefined) props[A.type] = { select: patch.type ? { name: patch.type } : null };
  if (patch.minutes !== undefined) props[A.minutes] = { number: patch.minutes };
  if (patch.priority !== undefined) props[A.priority] = { select: patch.priority ? { name: patch.priority } : null };
  if (patch.courseId !== undefined) props[A.course] = { relation: patch.courseId ? [{ id: patch.courseId }] : [] };
  for (const key of Object.keys(props)) {
    if (BOT_OWNED.has(key)) throw new Error(`Refusing to write bot-owned property "${key}"`);
  }
  return props;
}

export async function createTask(notion: Client, dataSourceId: string, input: NewTask): Promise<Task> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      ...toProperties({
        title: input.title,
        courseId: input.courseId,
        due: input.due,
        type: input.type,
        minutes: input.minutes,
        priority: input.priority ?? "Medium",
        status: "Not started",
      }),
      [A.source]: { select: { name: "Me" } },
    },
  });
  if (!isFullPage(page)) throw new Error("Notion returned a partial page");
  return toTask(page);
}

export async function updateTask(notion: Client, id: string, patch: TaskPatch): Promise<Task> {
  const page = await notion.pages.update({ page_id: id, properties: toProperties(patch) });
  if (!isFullPage(page)) throw new Error("Notion returned a partial page");
  return toTask(page);
}

/** "Delete" archives (trashes) the page; it can be restored from Notion's trash. */
export async function trashTask(notion: Client, id: string, trash: boolean): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: trash });
}
