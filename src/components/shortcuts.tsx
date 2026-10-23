"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { keyId, resolveKey, SHORTCUT_GROUPS, SHORTCUTS } from "@/lib/shortcuts";

/** True when keys typed now go into a box (letters must type, not run shortcuts). */
function isTyping(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "reset", "file"].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/** The visible element on this page marked for a shortcut. */
function marked(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-shortcut="${CSS.escape(id)}"]`);
  return [...all].find((el) => el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled) ?? null;
}

/**
 * Global key listener plus the "Shortcuts" button and help window (desktop only;
 * phones have no keyboard). Hidden on the login page.
 */
export function Shortcuts() {
  const path = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (path === "/login") return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || dialog.current?.open) return;
      const typing = isTyping(document.activeElement);
      const before = pending.current && Date.now() - pending.current.at < 1500 ? pending.current.key : null;
      const { run, pending: next } = resolveKey(keyId(e), typing, before);
      pending.current = next ? { key: next, at: Date.now() } : null;
      if (!run) return;

      if (run === "?") {
        e.preventDefault();
        dialog.current?.showModal();
        return;
      }
      if (run === "escape" && typing) {
        (document.activeElement as HTMLElement).blur();
        return;
      }
      const s = SHORTCUTS.find((x) => x.id === run);
      const url = s?.to?.(path);
      if (url) {
        e.preventDefault();
        if (s?.download) window.location.href = url;
        else router.push(url);
        return;
      }
      const el = marked(run);
      if (!el) return;
      e.preventDefault();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        el.select();
      } else {
        el.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  if (path === "/login") return null;
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink sm:inline-flex"
        aria-haspopup="dialog"
        title="Keyboard shortcuts (?)"
      >
        Shortcuts <Kbd>?</Kbd>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/30"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="shortcuts-title" className="text-base font-semibold">Keyboard shortcuts</h2>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-ink/5 hover:text-ink">
            Close <Kbd>Esc</Kbd>
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
          <p className="text-sm text-muted">
            Letter keys do nothing while you are typing in a box; Ctrl keys and Esc always work.
          </p>
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g}</h3>
              <dl className="divide-y divide-line">
                {SHORTCUTS.filter((s) => s.where === g).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                    <dt>{s.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <Fragment key={i}>
                          {i > 0 && <span className="text-xs text-muted">{s.id.includes(" ") ? "then" : "+"}</span>}
                          <Kbd>{k}</Kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-line bg-paper px-1.5 font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}
