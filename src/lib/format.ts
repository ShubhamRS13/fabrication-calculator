const kgFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const inrFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

/** 1234.5 → "1,234.500" */
export const kg = (n: number) => kgFmt.format(n);
/** 123456.7 → "₹1,23,456.70" */
export const inr = (n: number) => `₹${inrFmt.format(n)}`;
/** Plain number, up to 3 decimals, Indian grouping. */
export const num = (n: number) => numFmt.format(n);

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Parse a typed number; empty → null, invalid → NaN. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  if (t === "") return null;
  return Number(t);
}
