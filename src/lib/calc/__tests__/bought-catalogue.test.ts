import { describe, expect, it } from "vitest";
import { boughtLabel, DEFAULT_KINDS, findKind, normaliseDesc } from "../bought-catalogue";

const kind = (n: string) => findKind(DEFAULT_KINDS, n)!;

describe("bought-out catalogue", () => {
  it("has the agreed kinds", () => {
    for (const n of ["Flange", "Blind flange", "Stub end", "Socket", "Socket with plug", "Coupling", "Elbow", "Bend", "Tee", "Union", "Reducer", "Cap", "Bushing", "Hex head plug", "Nut-bolt-washer set", "Other"]) {
      expect(findKind(DEFAULT_KINDS, n), n).toBeDefined();
    }
    expect(kind("Nut-bolt-washer set").unit).toBe("set");
    expect(kind("Hose").unit).toBe("m");
  });

  it("names come from fields, so the same item is always named the same", () => {
    expect(boughtLabel(kind("Stub end"), { nb: "50", stub: "Long", rating: "SCH 10S" })).toBe("Stub end 50 NB Long SCH 10S");
    expect(boughtLabel(kind("Hex bolt"), { thread: "M10", len: 25 })).toBe("Hex bolt M10 × 25");
    expect(boughtLabel(kind("Tee"), { nb: "50", nb2: "50", end: "Butt-weld", rating: "SCH 10S" })).toBe("Tee 50 NB equal Butt-weld SCH 10S");
    expect(boughtLabel(kind("Reducer"), { nb: "80", nb2: "50", rtype: "Concentric", end: "Butt-weld", rating: "SCH 10S" })).toBe(
      "Reducer 80 NB × 50 NB Concentric Butt-weld SCH 10S",
    );
    expect(boughtLabel(kind("Blind flange"), { nb: "100", cls: "150#" })).toBe("Blind flange 100 NB 150#");
  });

  it("'Other' descriptions ignore case, spacing and punctuation", () => {
    expect(normaliseDesc("Ball valve  25nb, s/s")).toBe(normaliseDesc("BALL VALVE 25NB S/S"));
    expect(normaliseDesc("hex hd bolt M10x25")).toBe(normaliseDesc("HEX HD BOLT M10 X 25"));
    expect(boughtLabel(kind("Other"), { desc: " ball  valve 25 NB " })).toBe("BALL VALVE 25 NB");
  });
});
