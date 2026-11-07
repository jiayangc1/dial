import { NextResponse } from "next/server";
import { classify } from "@/lib/notion/client";
import { findSources, listSharedPages } from "@/lib/notion/discover";
import { getNotionContext, isDemo } from "@/lib/session";

// Step 2 of onboarding: the pages shared at consent, plus the tracker page
// Dial thinks is right (the one containing the Assignments + Courses data
// sources, detected by schema).
export async function GET() {
  if (isDemo()) {
    return NextResponse.json({
      pages: [
        { id: "demo-tracker", title: "Assignment Tracker", icon: "🎒" },
        { id: "demo-notes", title: "Class notes", icon: "📓" },
      ],
      detected: "demo-tracker",
      found: true,
    });
  }
  const ctx = await getNotionContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.reason }, { status: 401 });
  try {
    const [pages, sources] = await Promise.all([listSharedPages(ctx.notion), findSources(ctx.notion, null)]);
    const tracker = pages.find((p) => /assignment tracker/i.test(p.title)) ?? pages[0] ?? null;
    return NextResponse.json({ pages, detected: tracker?.id ?? null, found: !!sources });
  } catch (err) {
    const f = classify(err);
    if (f.kind === "reauth") return NextResponse.json({ error: "reauth" }, { status: 401 });
    return NextResponse.json({ error: "notion", message: f.message }, { status: 502 });
  }
}
