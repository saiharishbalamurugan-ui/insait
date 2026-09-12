import { createHmac, timingSafeEqual } from "crypto";

// Verifies the same signed session token the frontend mints on login (see
// apps/frontend/src/lib/session.ts) — the backend never signs one itself, only checks it,
// so Admin-only endpoints can trust who's calling instead of relying on a client-supplied name.

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
