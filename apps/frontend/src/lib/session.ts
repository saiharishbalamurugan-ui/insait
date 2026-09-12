import { createHmac, timingSafeEqual } from "crypto";

// Signs the real per-user session (userId/name/role) — mirrors the verification logic in
// apps/backend/src/auth/session-token.util.ts so the backend can independently check the
// same token when the frontend forwards it as x-session-token on Admin-only endpoints.

const SESSION_COOKIE_NAME = "audix_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "REVIEWER";
  iat: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  user: { id: string; name: string; email: string; role: string },
  secret: string,
): string {
  const payload: SessionPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" : "REVIEWER",
    iat: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  return `${Buffer.from(payloadStr).toString("base64url")}.${sign(payloadStr, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const payloadStr = Buffer.from(payloadB64, "base64url").toString();
  const expected = sign(payloadStr, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(payloadStr);
    if (!parsed.userId || !parsed.role) return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE };
