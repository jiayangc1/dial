import "server-only";
import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import type { Client } from "@notionhq/client";
import { notionFor } from "./notion/client";
import type { Sources } from "./notion/discover";

export const SOURCES_COOKIE = "dial.sources";

/**
 * Demo mode serves fixture data with no Notion connection, for trying Dial
 * out and for design reviews. It is opt-in and refuses to run in production
 * unless explicitly forced.
 */
export function isDemo(): boolean {
  if (process.env.DIAL_DEMO !== "1") return false;
  return process.env.NODE_ENV !== "production" || process.env.DIAL_DEMO_IN_PRODUCTION === "1";
}

export type NotionContext =
  | { ok: true; notion: Client; workspaceId: string | null; workspace: string | null; name: string | null; image: string | null }
  | { ok: false; reason: "signed_out" | "reauth" };

export async function getNotionContext(): Promise<NotionContext> {
  const h = await headers();
  // Auth.js prefixes the cookie with __Secure- when served over https.
  const secureCookie = (h.get("x-forwarded-proto") ?? "").split(",")[0] === "https" || (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({ req: { headers: h }, secret: process.env.AUTH_SECRET!, secureCookie });
  if (!token) return { ok: false, reason: "signed_out" };
  const n = token.notion;
  if (!n?.accessToken || n.error) return { ok: false, reason: "reauth" };
  return {
    ok: true,
    notion: notionFor(n.accessToken),
    workspaceId: n.workspaceId ?? null,
    workspace: n.workspaceName ?? null,
    name: token.name ?? null,
    image: token.picture ?? null,
  };
}

/** Data source IDs found during onboarding, scoped to the workspace they came from. */
export async function readSources(workspaceId: string | null): Promise<Sources | null> {
  const raw = (await cookies()).get(SOURCES_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Sources & { workspaceId?: string | null };
    if (!v.assignments || !v.courses) return null;
    if (workspaceId && v.workspaceId && v.workspaceId !== workspaceId) return null;
    return v;
  } catch {
    return null;
  }
}

export async function writeSources(sources: Sources, workspaceId: string | null) {
  (await cookies()).set(SOURCES_COOKIE, JSON.stringify({ ...sources, workspaceId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
