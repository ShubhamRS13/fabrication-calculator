import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-core";

// Sends anyone who isn't logged in to /login (and a logged-in visit to /login home).
// Pages, routes and server actions still check the session themselves (requireUser).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const user = verifySession(request.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET?.trim());
  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (user) return NextResponse.next();
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's own files, the logo/brand images, icons and the PWA manifest.
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|manifest.webmanifest|favicon.ico).*)"],
};
