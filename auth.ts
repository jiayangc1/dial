import NextAuth from "next-auth";
import Notion from "next-auth/providers/notion";

// Sessions are stateless, encrypted JWTs (JWE, A256CBC-HS512 keyed from
// AUTH_SECRET) in an httpOnly cookie. The Notion access token lives only
// inside that encrypted token: the session callback never copies it out, so
// /api/auth/session and the browser never see it. Server code reads it with
// getNotionToken() in lib/session.ts.

declare module "next-auth/jwt" {
  interface JWT {
    notion?: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number; // seconds since epoch
      workspaceName?: string;
      workspaceId?: string;
      error?: "refresh_failed";
    };
  }
}

declare module "next-auth" {
  interface Session {
    workspace?: string | null;
    error?: "refresh_failed";
  }
}

async function refresh(refreshToken: string) {
  const basic = Buffer.from(`${process.env.AUTH_NOTION_ID}:${process.env.AUTH_NOTION_SECRET}`).toString("base64");
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`refresh ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Notion({
      clientId: process.env.AUTH_NOTION_ID,
      clientSecret: process.env.AUTH_NOTION_SECRET,
      redirectUri: process.env.NOTION_REDIRECT_URI!,
      // The stock profile() assumes an email capability; don't crash without it.
      profile(profile) {
        const p = profile as { id: string; name?: string; avatar_url?: string | null; person?: { email?: string } };
        return { id: p.id, name: p.name ?? null, email: p.person?.email ?? null, image: p.avatar_url ?? null };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  pages: { signIn: "/", error: "/" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        const extra = account as unknown as { workspace_name?: string; workspace_id?: string };
        token.notion = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          workspaceName: extra.workspace_name,
          workspaceId: extra.workspace_id,
        };
        return token;
      }
      const n = token.notion;
      // Notion tokens may carry an expiry and refresh token; renew a minute early.
      if (n?.expiresAt && n.refreshToken && Date.now() / 1000 > n.expiresAt - 60) {
        try {
          const r = await refresh(n.refreshToken);
          token.notion = {
            ...n,
            accessToken: r.access_token,
            refreshToken: r.refresh_token ?? n.refreshToken,
            expiresAt: r.expires_in ? Math.floor(Date.now() / 1000) + r.expires_in : undefined,
            error: undefined,
          };
        } catch {
          token.notion = { ...n, error: "refresh_failed" };
        }
      }
      return token;
    },
    session({ session, token }) {
      // Deliberately narrow: no tokens leave the server.
      session.workspace = token.notion?.workspaceName ?? null;
      session.error = token.notion?.error;
      return session;
    },
  },
});
