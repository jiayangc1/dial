import "server-only";
import { isFullDataSource, isFullPage, type Client, type DataSourceObjectResponse } from "@notionhq/client";
import { A, C } from "./schema";

export type Sources = { assignments: string; courses: string; trackerPageId: string | null };

export type SharedPage = { id: string; title: string; icon: string | null };

function titleOf(rich: Array<{ plain_text: string }>) {
  return rich.map((t) => t.plain_text).join("").trim();
}

/** Pages the user shared with Dial during the Notion consent screen. */
export async function listSharedPages(notion: Client): Promise<SharedPage[]> {
  const res = await notion.search({
    filter: { property: "object", value: "page" },
    sort: { timestamp: "last_edited_time", direction: "descending" },
    page_size: 50,
  });
  const pages: SharedPage[] = [];
  for (const r of res.results) {
    if (!isFullPage(r)) continue;
    // Only standalone pages: rows inside a database are not tracker pages.
    if (r.parent.type === "data_source_id" || r.parent.type === "database_id") continue;
    const titleProp = Object.values(r.properties).find((p) => p.type === "title");
    const title = titleProp?.type === "title" ? titleOf(titleProp.title) : "";
    pages.push({ id: r.id, title: title || "Untitled", icon: r.icon?.type === "emoji" ? r.icon.emoji : null });
  }
  return pages;
}

function looksLikeAssignments(ds: DataSourceObjectResponse) {
  const p = ds.properties;
  return p[A.title]?.type === "title" && p[A.course]?.type === "relation" && p[A.status]?.type === "status";
}
function looksLikeCourses(ds: DataSourceObjectResponse) {
  const p = ds.properties;
  return p[C.title]?.type === "title" && p[C.enrolled]?.type === "checkbox";
}

/** Walk up from a data source's database to see if it lives under `pageId`. */
async function isUnder(notion: Client, ds: DataSourceObjectResponse, pageId: string): Promise<boolean> {
  const target = pageId.replace(/-/g, "");
  let parent: { type: string; page_id?: string; block_id?: string; database_id?: string } = ds.database_parent;
  for (let hop = 0; hop < 5; hop++) {
    if (parent.type === "page_id" && parent.page_id) {
      if (parent.page_id.replace(/-/g, "") === target) return true;
      const page = await notion.pages.retrieve({ page_id: parent.page_id });
      if (!isFullPage(page)) return false;
      parent = page.parent as typeof parent;
    } else if (parent.type === "block_id" && parent.block_id) {
      const block = await notion.blocks.retrieve({ block_id: parent.block_id });
      if (!("parent" in block)) return false;
      parent = block.parent as typeof parent;
    } else {
      return false;
    }
  }
  return false;
}

/**
 * Find the Assignments and Courses data sources by their schema (not by
 * name or a hard-coded ID). If more than one candidate exists, prefer the
 * ones that live under the tracker page the user picked.
 */
export async function findSources(notion: Client, trackerPageId: string | null): Promise<Sources | null> {
  const all: DataSourceObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.search({
      filter: { property: "object", value: "data_source" },
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results) if (isFullDataSource(r) && !r.in_trash) all.push(r);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // The Assignments "Course" relation points at the Courses data source,
  // which is the strongest signal for pairing the two.
  const assignments = all.filter(looksLikeAssignments);
  const courses = all.filter(looksLikeCourses);

  async function pick<T extends DataSourceObjectResponse>(list: T[]): Promise<T | undefined> {
    if (list.length <= 1 || !trackerPageId) return list[0];
    for (const ds of list) if (await isUnder(notion, ds, trackerPageId)) return ds;
    return list[0];
  }

  const a = await pick(assignments);
  if (!a) return null;
  const rel = a.properties[A.course];
  const relatedId = rel?.type === "relation" ? rel.relation.data_source_id : null;
  const c = courses.find((ds) => ds.id === relatedId) ?? (await pick(courses));
  if (!c) return null;
  return { assignments: a.id, courses: c.id, trackerPageId };
}
