import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/auth-core";

const MAX_AGE_S = 30 * 24 * 60 * 60;

/** Login settings from .env. `null` when any is missing (the login page says so). */
export function authConfig(): { username: string; passwordHash: string; secret: string } | null {
  const username = process.env.AUTH_USERNAME?.trim();
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim();
  const secret = process.env.AUTH_SECRET?.trim();
  return username && passwordHash && secret ? { username, passwordHash, secret } : null;
}

/** The logged-in user, or null. */
export async function getSessionUser(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, authConfig()?.secret);
}

export async function startSession(user: string, secret: string) {
  (await cookies()).set(SESSION_COOKIE, signSession(user, secret, MAX_AGE_S * 1000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
