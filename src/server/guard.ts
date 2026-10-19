import { redirect } from "next/navigation";
import { getSessionUser } from "./session";

/**
 * Every data read and every server action checks the session here, so a page,
 * route or action can't be reached without logging in, even if the proxy is bypassed.
 */
export async function requireUser(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
