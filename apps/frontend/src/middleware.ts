import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

// Node runtime (not the default Edge runtime) so session.ts can use Node's crypto module.
export const runtime = "nodejs";

export const config = {
  matcher: [
    "/((?!api/login|api/accept-invite|_next/static|_next/image|favicon.ico|icon.png|logo.jpg|pdf.worker.min.mjs).*)",
  ],
};

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/accept-invite") return NextResponse.next();

  const sessionSecret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionSecret && verifySessionToken(token, sessionSecret)) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
