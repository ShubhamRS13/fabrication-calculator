import Link from "next/link";

/** Shown wherever totals appear, so a costing with blank rates never looks finished. */
export function MissingRatesBanner({ missing, href }: { missing: { label: string }[]; href: string }) {
  if (!missing.length) return null;
  const shown = missing.slice(0, 4).map((m) => m.label).join(", ");
  return (
    <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      <strong>{missing.length} rate{missing.length === 1 ? "" : "s"} missing</strong> — totals are understated until they are entered: {shown}
      {missing.length > 4 && ` and ${missing.length - 4} more`}.{" "}
      <Link href={href} className="font-medium underline">Open Pricing</Link>
    </p>
  );
}
