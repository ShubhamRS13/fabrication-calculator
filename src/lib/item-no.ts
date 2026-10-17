// Item numbers are free text ("19A") but usually start with a number.
// Numbering restarts per assembly: loose drawing items have their own 1, 2, 3…

/** Leading integer of an item number: "19A" → 19, "A1" → null. */
export function leadingNumber(itemNo: string): number | null {
  const m = /^\s*(\d+)/.exec(itemNo);
  return m ? Number(m[1]) : null;
}

/** Next number after the highest leading integer in use: ["1", "19A", "3"] → "20". */
export function nextItemNo(existing: string[]): string {
  const max = existing.reduce((m, s) => Math.max(m, leadingNumber(s) ?? 0), 0);
  return String(max + 1);
}

/** Natural order: 1, 2, 10, 19A, 19B, then anything without a number. */
export function compareItemNo(a: string, b: string): number {
  const na = leadingNumber(a);
  const nb = leadingNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na === null && nb !== null) return 1;
  if (na !== null && nb === null) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
