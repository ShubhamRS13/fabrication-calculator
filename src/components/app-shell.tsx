import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavLinks, NavList } from "./nav-links";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/logo-mark-256.png" alt="" width={32} height={32} priority />
            <span className="font-semibold tracking-tight">Shubhangi Engineers</span>
          </Link>
          <nav className="hidden sm:block" aria-label="Main">
            <Suspense fallback={<NavList variant="top" path="" />}>
              <NavLinks variant="top" />
            </Suspense>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:pb-10">{children}</main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <Suspense fallback={<NavList variant="bottom" path="" />}>
          <NavLinks variant="bottom" />
        </Suspense>
      </nav>
    </div>
  );
}
