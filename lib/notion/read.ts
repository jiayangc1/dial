import "server-only";
import { isFullPage, type Client } from "@notionhq/client";
import type { QueryDataSourceParameters } from "@notionhq/client";
import { A, C } from "./schema";
import { toCourse, toTask } from "./map";
import { STATUS, type Course, type Task } from "../types";
import { startOfWeek } from "../time";
import { timezone } from "@/config/bells";

async function queryAll(notion: Client, args: QueryDataSourceParameters) {
  const pages = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({ ...args, start_cursor: cursor, page_size: 100 });
    for (const r of res.results) if (isFullPage(r)) pages.push(r);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

export async function readCourses(notion: Client, dataSourceId: string): Promise<Course[]> {
  const pages = await queryAll(notion, {
    data_source_id: dataSourceId,
    filter: { property: C.enrolled, checkbox: { equals: true } },
    sorts: [{ property: C.title, direction: "ascending" }],
  });
  return pages.map(toCourse);
}

/**
 * Everything the wheel needs in one query (1–2 requests instead of one per
 * class): every open task, plus tasks completed since Monday for the
 * "Done this week" section and the progress rings.
 */
export async function readTasks(notion: Client, dataSourceId: string, now = new Date()): Promise<Task[]> {
  const weekStart = startOfWeek(now, timezone).toISOString();
  const notComplete = STATUS.complete.map((s) => ({ property: A.status, status: { does_not_equal: s } }));
  const notOpen = [...STATUS.todo, ...STATUS.in_progress].map((s) => ({ property: A.status, status: { does_not_equal: s } }));

  const pages = await queryAll(notion, {
    data_source_id: dataSourceId,
    filter: {
      or: [
        { and: notComplete },
        { and: [...notOpen, { timestamp: "last_edited_time", last_edited_time: { on_or_after: weekStart } }] },
      ],
    },
    sorts: [{ property: A.due, direction: "ascending" }],
  });
  return pages.map(toTask);
}
