import { randomBytes, createHash } from "crypto";

export const INVITE_EXPIRY_HOURS = 72;

export function generateInviteToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token), expiresAt: expiryFromNow() };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiryFromNow(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
}

export function buildInviteUrl(token: string): string {
  const base = process.env.FRONTEND_URL ?? "http://localhost:3000";
  return `${base}/accept-invite?token=${token}`;
}
