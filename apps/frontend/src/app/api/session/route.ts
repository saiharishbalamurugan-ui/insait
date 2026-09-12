import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = sessionSecret ? verifySessionToken(token, sessionSecret) : null;

  if (!payload) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { id: payload.userId, name: payload.name, email: payload.email, role: payload.role },
  });
}
