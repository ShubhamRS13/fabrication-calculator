"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { cx } from "./ui";

const LINKS = [
  { href: "/", label: "Costings", match: (p: string) => p === "/" || p.startsWith("/costings") },
  { href: "/settings", label: "Library & settings", short: "Settings", match: (p: string) => p.startsWith("/settings") },
];

/** Highlights the current section. Needs <Suspense>: the path is only known at request time. */
export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  if (path === "/login") return null;
  return <NavList variant={variant} path={path} />;
}

/** Ends the session. Hidden on the login page. */
export function LogoutButton() {
  if (usePathname() === "/login") return null;
  return (
    <form action={logoutAction}>
      <button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">
        Log out
      </button>
    </form>
  );
}

/** The same links without a highlighted section; used as the Suspense fallback. */
export function NavList({ variant, path }: { variant: "top" | "bottom"; path: string }) {
  if (variant === "top") {
    return (
      <ul className="flex gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={l.match(path) ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-2 text-sm font-medium",
                l.match(path) ? "bg-ink text-white" : "text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2">
      {LINKS.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            aria-current={l.match(path) ? "page" : undefined}
            className={cx(
              "flex h-14 items-center justify-center text-sm font-medium",
              l.match(path) ? "text-ink" : "text-muted",
            )}
          >
            <span className={cx("border-b-2 pb-0.5", l.match(path) ? "border-ink" : "border-transparent")}>
              {l.short ?? l.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
