import Link from "next/link";
import { Suspense } from "react";
import { Card, CardHeader, Empty, PageTitle, Skeleton } from "@/components/ui";
import { kg, num } from "@/lib/format";
import { rawMaterialList, rmBuy, RM_GROUP_LABEL, RM_GROUP_ORDER, type RmGroup, type RmLine, type RmRow } from "@/lib/calc/raw-material";
import type { PriceUnit } from "@/lib/calc/types";
import { loadCosting } from "@/server/load";

export const metadata = { title: "Raw material" };

const LENGTH_GROUPS: RmGroup[] = ["pipe", "flat", "section"];
const COUNT_GROUPS: RmGroup[] = ["hardware", "bought", "jobwork"];

const mFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metres = (x: number) => `${mFmt.format(x)} m`;
const mm = (x: number) => num(Math.round(x));
const UNIT: Record<PriceUnit, string> = { piece: "pcs", set: "sets", m: "m", kg: "kg" };

const GROUP_SUB: Record<RmGroup, string> = {
  sheet: "By material and thickness. Buy kg = process (sheet rectangle) + burning.",
  pipe: "Total cut length of each size.",
  flat: "Total cut length of each width × thickness, rings rolled from flat included.",
  section: "Total cut length of each section and bar.",
  other: "Custom shapes, by material.",
  hardware: "Bolts, studs, nuts, washers and sets.",
  bought: "Bought ready-made.",
  jobwork: "Work sent out, e.g. dish forming. The blank plate is under Sheets.",
};

export default function RawMaterialPage(props: PageProps<"/costings/[id]/raw-material">) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <RawMaterial params={props.params} />
    </Suspense>
  );
}

async function RawMaterial({ params }: { params: Promise<{ id: string }> }) {
  const { tree, input, result } = await loadCosting(params);
  const c = tree.costing;
  const base = `/costings/${c.id}`;
  const list = rawMaterialList(input, result);
  const groups = RM_GROUP_ORDER.map((g) => ({ group: g, rows: list.rows.filter((r) => r.group === g) })).filter((g) => g.rows.length > 0);
  const itemHref = (l: { drawingId: string; itemId: string }) => `${base}/drawings/${l.drawingId}/items/${l.itemId}`;

  return (
    <>
      <PageTitle
        back={{ href: base, label: c.projectName }}
        title="Raw material"
        sub={`${c.clientName} · ${c.projectName} · what to buy for every drawing, quantities × assembly qty`}
        action={
          <div className="flex gap-2">
            <a
              href={`${base}/export/raw-material-excel`}
              download
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium hover:bg-paper"
            >
              Download Excel
            </a>
            <a
              href={`${base}/export/raw-material-pdf`}
              download
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium hover:bg-paper"
            >
              Download PDF
            </a>
          </div>
        }
      />

      {list.skipped.length > 0 && (
        <Card className="mb-4 border-danger">
          <CardHeader title={`${list.skipped.length} item${list.skipped.length === 1 ? "" : "s"} not included`} sub="These items have an error. Fix them to add them to the list." />
          <ul className="divide-y divide-line text-sm">
            {list.skipped.map((s) => (
              <li key={s.itemId}>
                <Link href={itemHref(s)} className="block px-4 py-2 hover:bg-paper">
                  <span className="font-medium">{s.drawingNo} · {s.itemNo ? `${s.itemNo} ` : ""}{s.itemName}</span>
                  <span className="block text-danger">{s.error}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <Empty>No items yet. Add items to the drawings and the list fills itself.</Empty>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader title="To buy" />
            <ul className="grid grid-cols-2 overflow-hidden lg:grid-cols-4">
              {groups.map(({ group, rows }) => (
                <li key={group} className="-mb-px -mr-px border-b border-r border-line">
                  <a href={`#${group}`} className="block px-4 py-3 hover:bg-paper">
                    <span className="block text-sm text-muted">{RM_GROUP_LABEL[group]}</span>
                    <span className="block font-semibold tabular-nums">{groupTotal(group, rows)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4">
            {groups.map(({ group, rows }) => (
              <Card key={group} id={group} className="scroll-mt-20">
                <CardHeader title={RM_GROUP_LABEL[group]} sub={GROUP_SUB[group]} />
                <ul className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <MaterialHeadAndRow key={r.key} row={r} prev={rows[i - 1]} rows={rows} itemHref={itemHref} />
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function groupTotal(group: RmGroup, rows: RmRow[]): string {
  const sizes = `${rows.length} ${rows.length === 1 ? "size" : "sizes"}`;
  if (group === "sheet" || group === "other") return `${kg(rows.reduce((a, r) => a + r.buyKg, 0))} kg`;
  if (LENGTH_GROUPS.includes(group)) return `${sizes} · ${metres(rows.reduce((a, r) => a + r.lengthM, 0))}`;
  return `${rows.length} ${rows.length === 1 ? "line" : "lines"}`;
}

function MaterialHeadAndRow({ row, prev, rows, itemHref }: { row: RmRow; prev?: RmRow; rows: RmRow[]; itemHref: (l: RmLine) => string }) {
  const head = !prev || prev.material !== row.material;
  const same = rows.filter((r) => r.material === row.material);
  const weighed = !COUNT_GROUPS.includes(row.group);
  return (
    <>
      {head && (
        <li className="flex justify-between bg-paper px-4 py-1.5 text-xs font-semibold text-muted">
          <span>{row.material}</span>
          {weighed && <span className="tabular-nums">{kg(same.reduce((a, r) => a + r.buyKg, 0))} kg</span>}
        </li>
      )}
      <li>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-paper [&::-webkit-details-marker]:hidden">
            <span className="mt-0.5 text-xs text-muted transition-transform group-open:rotate-90" aria-hidden>▶</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.label}</p>
              <p className="text-sm text-muted">{detail(row)}</p>
              <p className="text-xs text-muted">Used in {row.drawings.join(", ")}</p>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <p className="font-semibold">{main(row)}</p>
              {mainSub(row) && <p className="text-xs text-muted">{mainSub(row)}</p>}
            </div>
          </summary>
          <Lines row={row} itemHref={itemHref} />
        </details>
      </li>
    </>
  );
}

function main(r: RmRow): string {
  const b = rmBuy(r);
  return b.unit === "kg" ? `${kg(b.qty)} kg` : b.unit === "m" ? metres(b.qty) : `${num(b.qty)} ${b.unit}`;
}

function mainSub(r: RmRow): string | null {
  if (r.group === "sheet") return "to buy";
  if (LENGTH_GROUPS.includes(r.group)) return `${kg(r.buyKg)} kg`;
  if ((r.unit === "m" && r.lengthM > 0) || (r.unit === "kg" && r.finishKg > 0)) return `${num(r.pieces)} pcs`;
  if (r.unit === "m") return "length not entered";
  if (r.unit === "kg") return "weight not entered";
  return null;
}

function detail(r: RmRow): string {
  const pcs = `${num(r.pieces)} piece${r.pieces === 1 ? "" : "s"}`;
  if (r.group === "sheet") {
    const largest = r.largest ? ` · largest ${mm(r.largest.w)} × ${mm(r.largest.l)}` : "";
    return `Process ${kg(r.processKg)} + burning ${kg(r.burningKg)} kg · ${pcs}${largest}`;
  }
  if (LENGTH_GROUPS.includes(r.group)) return `${pcs} · longest ${mm(r.longestMm)} mm`;
  if (r.group === "other") return `Process ${kg(r.processKg)} + burning ${kg(r.burningKg)} kg · ${pcs}`;
  return r.group === "jobwork" ? "Per piece" : `Counted in ${UNIT[r.unit ?? "piece"]}`;
}

function Lines({ row, itemHref }: { row: RmRow; itemHref: (l: RmLine) => string }) {
  const sheet = row.group === "sheet";
  const length = LENGTH_GROUPS.includes(row.group);
  const showKg = !COUNT_GROUPS.includes(row.group) || row.lines.some((l) => l.kg > 0);
  return (
    <div className="overflow-x-auto border-t border-line bg-paper/50 px-4 pb-3 pt-1">
      <table className="w-full min-w-[30rem] text-sm tabular-nums">
        <thead>
          <tr className="text-right text-xs text-muted">
            {sheet && <th className="py-1.5 pr-2 font-medium">W × L mm</th>}
            {length && <th className="py-1.5 pr-2 font-medium">Cut length mm</th>}
            <th className="py-1.5 pr-2 font-medium">Qty</th>
            {length && <th className="py-1.5 pr-2 font-medium">Total m</th>}
            {showKg && <th className="py-1.5 pr-2 font-medium">kg</th>}
            <th className="py-1.5 pl-2 text-left font-medium">Item</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l, i) => (
            <tr key={`${l.itemId}-${i}`} className="border-t border-line text-right">
              {sheet && <td className="py-1.5 pr-2 whitespace-nowrap">{mm(l.w ?? 0)} × {mm(l.l ?? 0)}</td>}
              {length && <td className="py-1.5 pr-2">{mm(l.lengthMm ?? 0)}</td>}
              <td className="py-1.5 pr-2">{num(l.qty)}</td>
              {length && <td className="py-1.5 pr-2">{mFmt.format(((l.lengthMm ?? 0) * l.qty) / 1000)}</td>}
              {showKg && <td className="py-1.5 pr-2">{kg(l.kg)}</td>}
              <td className="whitespace-nowrap py-1.5 pl-2 text-left">
                <Link href={itemHref(l)} className="hover:underline">
                  {l.drawingNo} · {l.itemNo ? `${l.itemNo} ` : ""}{l.itemName}
                </Link>
                {l.assembly && <span className="text-xs text-muted"> ({l.assembly})</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
