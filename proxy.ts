import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic routing only: the real checks happen in the route handlers.
// Signed-in visitors skip the landing page; signed-out visitors can't reach
// the app shell or onboarding.
const demo = process.env.DIAL_DEMO === "1" && (process.env.NODE_ENV !== "production" || process.env.DIAL_DEMO_IN_PRODUCTION === "1");

export default auth((req) => {
  if (demo) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  const signedIn = !!req.auth && !req.auth.error;
  if (pathname === "/" && signedIn && !search.includes("expired")) return NextResponse.redirect(new URL("/app", req.url));
  if ((pathname.startsWith("/app") || pathname.startsWith("/onboarding")) && !signedIn) {
    return NextResponse.redirect(new URL(req.auth?.error ? "/?expired=1" : "/", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/app/:path*", "/onboarding/:path*"],
};
