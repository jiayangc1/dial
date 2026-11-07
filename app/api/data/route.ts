import { NextResponse, type NextRequest } from "next/server";
import { classify } from "@/lib/notion/client";
import { readCourses, readTasks } from "@/lib/notion/read";
import { demoSnapshot } from "@/lib/demo";
import { getNotionContext, isDemo, readSources } from "@/lib/session";
import type { Snapshot } from "@/lib/types";

// One round trip for everything the app shell needs: enrolled courses and
// open + done-this-week tasks. Courses and tasks are fetched in parallel
// through the per-token rate-limit queue.
export async function GET(req: NextRequest) {
  if (isDemo()) {
    return NextResponse.json(demoSnapshot(req.nextUrl.searchParams.get("scenario")), { headers: { "Cache-Control": "no-store" } });
  }

  const ctx = await getNotionContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.reason }, { status: 401 });

  const sources = await readSources(ctx.workspaceId);
  if (!sources) return NextResponse.json({ error: "onboarding" }, { status: 409 });

  try {
    const [courses, tasks] = await Promise.all([readCourses(ctx.notion, sources.courses), readTasks(ctx.notion, sources.assignments)]);
    const body: Snapshot = {
      user: { name: ctx.name, image: ctx.image, workspace: ctx.workspace },
      courses,
      tasks,
      fetchedAt: new Date().toISOString(),
      demo: false,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const f = classify(err);
    if (f.kind === "reauth") return NextResponse.json({ error: "reauth" }, { status: 401 });
    if (f.kind === "not_found") return NextResponse.json({ error: "onboarding", message: f.message }, { status: 409 });
    return NextResponse.json({ error: "notion", message: f.message }, { status: 502 });
  }
}
