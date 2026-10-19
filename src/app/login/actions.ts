"use server";

import { redirect } from "next/navigation";
import { sameUser, verifyPassword } from "@/lib/auth-core";
import { authConfig, endSession, startSession } from "@/server/session";

/** `username` keeps what was typed, so a failed try only clears the password. */
export type LoginState = { error?: string; username?: string };

/** Only same-site paths, so the login can't be used to bounce to another site. */
function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const config = authConfig();
  if (!config) return { error: "Login is not set up on this server (AUTH_* settings missing)." };
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  if (!sameUser(username, config.username) || !verifyPassword(password, config.passwordHash)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Wrong username or password.", username };
  }
  await startSession(config.username, config.secret);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
