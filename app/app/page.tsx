import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DialApp } from "@/components/dial-app";
import { loadSnapshot, parseNowParam } from "@/lib/snapshot";

// Rendered per request with the data already in it, so the task list paints
// straight from HTML instead of waiting for JS and a client-side fetch.
//
// This is deliberately a blocking route rather than a static shell plus a
// streamed <Suspense> boundary: Notion answers in a few hundred ms, and a
// skeleton that flashes for that long and is then swapped in by script
// paints later than just sending the finished page. The client polls
// /api/data afterwards to stay fresh.
export const instant = false;

export default function AppPage({ searchParams }: PageProps<"/app">) {
  return <FirstView searchParams={searchParams} />;
}

async function FirstView({ searchParams }: { searchParams: PageProps<"/app">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const scenario = one(sp.scenario);
  const nowParam = one(sp.now);

  const r = await loadSnapshot({ scenario, now: nowParam });
  if (!r.ok) {
    if (r.reason === "signed_out") redirect("/");
    if (r.reason === "reauth") redirect("/auth/expired");
    if (r.reason === "onboarding") redirect("/onboarding");
    // Notion hiccup: render the shell; the client retries and shows the error banner.
    return <DialApp initial={null} />;
  }

  // The clock the first render uses. `?now=` shifts it (school-local wall time).
  const n = parseNowParam(nowParam);
  return <DialApp initial={{ snapshot: r.snapshot, now: n ? n.at.getTime() : r.requestedAt, requestedAt: r.requestedAt, scenario }} />;
}
