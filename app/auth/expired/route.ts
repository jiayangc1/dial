import { NextResponse, type NextRequest } from "next/server";

// Notion rejected the token (401/403). Clear the session and return to the
// landing page, which explains what happened.
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/?expired=1", req.url));
  for (const c of req.cookies.getAll()) {
    if (c.name.includes("authjs.session-token")) res.cookies.delete(c.name);
  }
  return res;
}
