// Login arrives in step 0.3. Until then the app must not run in production,
// because server actions are public POST endpoints.
export async function requireUser(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_NO_AUTH !== "1") {
    throw new Error("Login is not set up yet (step 0.3). The app cannot run in production without it.");
  }
}
