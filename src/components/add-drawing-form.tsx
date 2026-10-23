"use client";

import { useRef, useState, useTransition } from "react";
import { addDrawingAction } from "@/app/actions";
import { Button, ErrorText, Input } from "./ui";

export function AddDrawingForm({ costingId }: { costingId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const form = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    const drawingNo = String(fd.get("drawingNo") ?? "").trim();
    const title = String(fd.get("title") ?? "").trim();
    start(async () => {
      const res = await addDrawingAction(costingId, { drawingNo, title });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      form.current?.reset();
    });
  }

  return (
    <form ref={form} action={submit} className="grid gap-2 border-t border-line px-4 py-3 sm:grid-cols-[12rem_1fr_auto]">
      <Input name="drawingNo" required placeholder="Drawing no." aria-label="Drawing no." data-shortcut="n" />
      <Input name="title" placeholder="Title, e.g. Storage Hopper" aria-label="Drawing title" />
      <Button type="submit" variant="primary" disabled={pending}>+ Add drawing</Button>
      <div className="sm:col-span-3"><ErrorText>{error}</ErrorText></div>
    </form>
  );
}
