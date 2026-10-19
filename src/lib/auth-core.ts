import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Single-user login (step 0.3), Node crypto only.
//   Password: stored as an scrypt hash "scrypt:N:r:p:salt:hash" (base64url), never as text.
//             ":" not "$": Next expands $NAME inside .env values.
//   Session:  "user.expiresMs.signature", signed with HMAC-SHA256 and AUTH_SECRET.

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

/** Name of the session cookie. */
export const SESSION_COOKIE = "se_session";

const b64 = (b: Buffer) => b.toString("base64url");

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${b64(salt)}:${b64(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, n, r, p, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A random secret for signing sessions (AUTH_SECRET). */
export const newSecret = () => b64(randomBytes(32));

const sign = (payload: string, secret: string) => b64(createHmac("sha256", secret).update(payload).digest());

export function signSession(user: string, secret: string, maxAgeMs: number, now = Date.now()): string {
  const payload = `${b64(Buffer.from(user))}.${now + maxAgeMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The user the token was signed for, or null if it is forged, malformed or expired. */
export function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()): string | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts;
  const expected = Buffer.from(sign(`${user}.${exp}`, secret));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (!(Number(exp) > now)) return null;
  return Buffer.from(user, "base64url").toString();
}

/** Usernames match without regard to case; "Shubham" = "shubham". */
export const sameUser = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
