"use server";

import { signIn, signOut } from "@/auth";
import { classify } from "@/lib/notion/client";
import { findSources } from "@/lib/notion/discover";
import { getNotionContext, isDemo, writeSources, SOURCES_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function continueWithNotion() {
  if (isDemo()) redirect("/app");
  await signIn("notion", { redirectTo: "/app" });
}

export async function signOutAction() {
  (await cookies()).delete(SOURCES_COOKIE);
  if (isDemo()) redirect("/");
  await signOut({ redirectTo: "/" });
}

export type ConnectResult = { ok: true } | { ok: false; message: string; reauth?: boolean };

/** Onboarding step 2: resolve and remember the two data sources. */
export async function connectTracker(trackerPageId: string): Promise<ConnectResult> {
  if (isDemo()) return { ok: true };
  const ctx = await getNotionContext();
  if (!ctx.ok) return { ok: false, message: "Please sign in again.", reauth: true };
  try {
    const sources = await findSources(ctx.notion, trackerPageId);
    if (!sources) {
      return {
        ok: false,
        message: "Couldn't find the Assignments and Courses databases on that page. Make sure both were shared with Dial.",
      };
    }
    await writeSources(sources, ctx.workspaceId);
    return { ok: true };
  } catch (err) {
    const f = classify(err);
    return { ok: false, message: f.message, reauth: f.kind === "reauth" };
  }
}
