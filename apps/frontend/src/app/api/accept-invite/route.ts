import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_SHARED_SECRET = process.env.NEXT_PUBLIC_API_SHARED_SECRET;

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: "Login isn't configured on this server." }, { status: 500 });
  }

  const backendRes = await fetch(`${API_BASE_URL}/auth/accept-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_SHARED_SECRET ? { "x-app-secret": API_SHARED_SECRET } : {}),
    },
    body: JSON.stringify({ token, password }),
  });

  if (!backendRes.ok) {
    const body = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { ok: false, error: body.message ?? "This invite link isn't valid." },
      { status: backendRes.status },
    );
  }

  const user = await backendRes.json();
  const sessionToken = createSessionToken(user, sessionSecret);

  const res = NextResponse.json({
    ok: true,
    token: sessionToken,
    user: { id: user.id, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
