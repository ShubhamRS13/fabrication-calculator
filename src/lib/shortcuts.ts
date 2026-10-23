// Keyboard shortcuts: one list drives both the key listener and the help window.
//
// A shortcut either
//   - clicks / focuses the element on the page marked `data-shortcut="<id>"`, or
//   - goes to a page worked out from the current path (`to`).
// Plain letter keys never fire while typing in a box; only Ctrl/⌘ keys and Esc do.

export interface Shortcut {
  /** Key id as `keyId()` returns it, or a two-key sequence "g c". */
  id: string;
  /** How the keys are shown in the help window. */
  keys: string[];
  label: string;
  /** Help window group. */
  where: "Everywhere" | "Costings list" | "Costing pages" | "Drawing" | "Item editor";
  /** Page to open; null when it does not apply on this path. Without `to`, the marked element is used. */
  to?: (path: string) => string | null;
  /** Opens a file download rather than a page. */
  download?: boolean;
}

const costingBase = (path: string) => path.match(/^\/costings\/([0-9a-f-]{36})/)?.[0] ?? null;
// Not from the item editor: a stray letter there must not throw away unsaved sizes.
const under = (suffix: string) => (path: string) => {
  const b = costingBase(path);
  return b && !path.includes("/items/") ? `${b}${suffix}` : null;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "?", keys: ["?"], label: "Show this list of shortcuts", where: "Everywhere" },
  { id: "g c", keys: ["g", "c"], label: "Go to Costings", where: "Everywhere", to: () => "/" },
  { id: "g s", keys: ["g", "s"], label: "Go to Library & settings", where: "Everywhere", to: () => "/settings" },
  { id: "b", keys: ["b"], label: "Back one level (the ← link at the top)", where: "Everywhere" },

  { id: "/", keys: ["/"], label: "Search costings", where: "Costings list" },
  { id: "n", keys: ["n"], label: "New costing / add drawing / add item (whatever the page adds)", where: "Everywhere" },

  { id: "o", keys: ["o"], label: "Costing overview (drawings)", where: "Costing pages", to: under("") },
  // (Costing-page letters do nothing in the item editor, so unsaved sizes are never lost.)
  { id: "r", keys: ["r"], label: "Rates", where: "Costing pages", to: under("/pricing") },
  { id: "s", keys: ["s"], label: "Costing summary", where: "Costing pages", to: under("/summary") },
  { id: "m", keys: ["m"], label: "Raw material list", where: "Costing pages", to: under("/raw-material") },
  { id: "e", keys: ["e"], label: "Download costing Excel", where: "Costing pages", to: under("/export/excel"), download: true },
  { id: "p", keys: ["p"], label: "Download costing PDF", where: "Costing pages", to: under("/export/pdf"), download: true },

  { id: "[", keys: ["["], label: "Previous drawing", where: "Drawing" },
  { id: "]", keys: ["]"], label: "Next drawing", where: "Drawing" },

  { id: "mod+s", keys: ["Ctrl", "S"], label: "Save item", where: "Item editor" },
  { id: "mod+enter", keys: ["Ctrl", "Enter"], label: "Save and add another", where: "Item editor" },
  { id: "escape", keys: ["Esc"], label: "Leave the box you are typing in; press again to cancel", where: "Item editor" },
];

export const SHORTCUT_GROUPS = [...new Set(SHORTCUTS.map((s) => s.where))];

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** "mod+s", "mod+enter", "escape", "?", "g"…; null for keys that are never shortcuts. */
export function keyId(e: KeyLike): string | null {
  if (e.altKey) return null;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key === "Enter" ? "enter" : e.key === "Escape" ? "escape" : e.key.length === 1 ? e.key.toLowerCase() : null;
  if (!k) return null;
  if (mod) return k === "s" || k === "enter" ? `mod+${k}` : null;
  return k;
}

/** Whether a key may fire while the cursor is in a text box. */
export const worksWhileTyping = (id: string) => id.startsWith("mod+") || id === "escape";

const KNOWN = new Set(SHORTCUTS.map((s) => s.id));
const SEQ_STARTS = new Set(SHORTCUTS.filter((s) => s.id.includes(" ")).map((s) => s.id.split(" ")[0]));

/**
 * Turns one key press into a shortcut id, given the first key of a pending
 * sequence ("g"). Returns the shortcut to run (if any) and the new pending key.
 */
export function resolveKey(id: string | null, typing: boolean, pending: string | null): { run: string | null; pending: string | null } {
  if (!id) return { run: null, pending: null };
  if (typing && !worksWhileTyping(id)) return { run: null, pending: null };
  if (pending) {
    const seq = `${pending} ${id}`;
    if (KNOWN.has(seq)) return { run: seq, pending: null };
  }
  if (SEQ_STARTS.has(id)) return { run: null, pending: id };
  return { run: KNOWN.has(id) ? id : null, pending: null };
}
