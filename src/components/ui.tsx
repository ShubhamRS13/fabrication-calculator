import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Small presentational building blocks shared by server and client components.

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const btn = {
  base: "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 h-10 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  primary: "bg-ink text-white hover:bg-ink/85",
  secondary: "bg-white text-ink border border-line hover:bg-paper",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger/5",
  ghost: "text-ink hover:bg-ink/5",
};
type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({ variant = "secondary", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...p} className={cx(btn.base, btn[variant], className)} />;
}

export function ButtonLink({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...p} className={cx(btn.base, btn[variant], className)} />;
}

export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section {...p} className={cx("rounded-xl border border-line bg-white", className)} />;
}

export function CardHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, sub, back, action }: { title: ReactNode; sub?: ReactNode; back?: { href: string; label: string }; action?: ReactNode }) {
  return (
    <div className="mb-4">
      {back && (
        <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </span>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cx(inputCls, className)} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cx(inputCls, "pr-8", className)} />;
}

export function Stat({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={cx("text-sm", strong ? "font-semibold text-ink" : "text-muted")}>{label}</span>
      <span className={cx("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-sm text-ink")}>{value}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="text-sm text-danger">{children}</p>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-line/60" />
      ))}
    </div>
  );
}
