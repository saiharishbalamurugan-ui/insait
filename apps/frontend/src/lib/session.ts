import { createHmac, timingSafeEqual } from "crypto";

// Signs a simple token — not a full auth system, just enough to keep the shared
// password gate from being trivially forged by editing the cookie value.

const SESSION_COOKIE_NAME = "audix_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(secret: string): string {
  const payload = `authenticated.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;
  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE };
