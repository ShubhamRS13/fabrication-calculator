import { describe, expect, it } from "vitest";
import { compareItemNo, leadingNumber, nextItemNo } from "../item-no";

describe("item numbers", () => {
  it("reads the leading number", () => {
    expect(leadingNumber("19A")).toBe(19);
    expect(leadingNumber(" 7")).toBe(7);
    expect(leadingNumber("A1")).toBeNull();
    expect(leadingNumber("")).toBeNull();
  });

  it("suggests the next number after the highest", () => {
    expect(nextItemNo([])).toBe("1");
    expect(nextItemNo(["1", "2", "3"])).toBe("4");
    expect(nextItemNo(["1", "19A", "3"])).toBe("20");
    expect(nextItemNo(["A", "B"])).toBe("1");
  });

  it("sorts naturally", () => {
    expect(["10", "2", "19B", "1", "19A", "X", ""].sort(compareItemNo)).toEqual(["1", "2", "10", "19A", "19B", "", "X"]);
  });
});
