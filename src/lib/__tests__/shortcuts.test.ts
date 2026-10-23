import { describe, expect, it } from "vitest";
import { keyId, resolveKey, SHORTCUTS } from "../shortcuts";

const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  keyId({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("keyboard shortcuts", () => {
  it("reads keys", () => {
    expect(k("M")).toBe("m");
    expect(k("s", { ctrlKey: true })).toBe("mod+s");
    expect(k("s", { metaKey: true })).toBe("mod+s");
    expect(k("Enter", { ctrlKey: true })).toBe("mod+enter");
    expect(k("Escape")).toBe("escape");
    expect(k("c", { ctrlKey: true })).toBeNull(); // copy stays copy
    expect(k("ArrowLeft", { altKey: true })).toBeNull(); // browser back stays back
    expect(k("Shift")).toBeNull();
  });

  it("letters never fire while typing in a box", () => {
    for (const key of ["c", "g", "m", "r", "s", "n", "e", "p", "/", "?", "[", "b"]) {
      expect(resolveKey(k(key), true, null)).toEqual({ run: null, pending: null });
    }
    expect(resolveKey("c", true, "g").run).toBeNull();
  });

  it("Ctrl keys and Esc work while typing", () => {
    expect(resolveKey("mod+s", true, null).run).toBe("mod+s");
    expect(resolveKey("mod+enter", true, null).run).toBe("mod+enter");
    expect(resolveKey("escape", true, null).run).toBe("escape");
  });

  it("g then c / s is a two-key sequence", () => {
    const first = resolveKey("g", false, null);
    expect(first).toEqual({ run: null, pending: "g" });
    expect(resolveKey("c", false, first.pending).run).toBe("g c");
    expect(resolveKey("s", false, "g").run).toBe("g s");
    expect(resolveKey("s", false, null).run).toBe("s");
    expect(resolveKey("x", false, "g")).toEqual({ run: null, pending: null });
  });

  it("costing pages work out their links from the path", () => {
    const id = "5c8dcb22-60a1-4b2c-9125-2dcd6b3c37a6";
    const to = (sid: string, path: string) => SHORTCUTS.find((s) => s.id === sid)!.to!(path);
    expect(to("r", `/costings/${id}/drawings/x`)).toBe(`/costings/${id}/pricing`);
    expect(to("r", `/costings/${id}/drawings/x/items/y`)).toBeNull(); // item editor: unsaved work
    expect(to("e", `/costings/${id}`)).toBe(`/costings/${id}/export/excel`);
    expect(to("m", "/")).toBeNull();
    expect(to("r", "/costings/new")).toBeNull();
  });

  it("every shortcut is unique", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
