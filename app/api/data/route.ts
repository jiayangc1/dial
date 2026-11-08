import { connection } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { loadSnapshot } from "@/lib/snapshot";

// Polled by the client every 60s (the first view is server-rendered).
export async function GET(req: NextRequest) {
  await connection(); // always per-request: this reads the session
  const r = await loadSnapshot({ scenario: req.nextUrl.searchParams.get("scenario"), now: req.nextUrl.searchParams.get("now") });
  if (r.ok) return NextResponse.json(r.snapshot, { headers: { "Cache-Control": "private, no-store" } });
  if (r.reason === "signed_out" || r.reason === "reauth") return NextResponse.json({ error: r.reason }, { status: 401 });
  if (r.reason === "onboarding") return NextResponse.json({ error: "onboarding" }, { status: 409 });
  return NextResponse.json({ error: "notion", message: r.reason === "notion" ? r.message : "" }, { status: 502 });
}
