import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Same salt:derived-hex scrypt format the original seed script used, so pre-existing
// seeded users' password hashes remain valid without a data migration.

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, derived] = hash.split(":");
  if (!salt || !derived) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
