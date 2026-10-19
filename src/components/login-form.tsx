"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { Button, ErrorText, Input, Label } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label>Username</Label>
        <Input key={state.username} name="username" defaultValue={state.username} autoComplete="username" autoCapitalize="none" required autoFocus={!state.username} />
      </div>
      <div>
        <Label>Password</Label>
        <Input name="password" type="password" autoComplete="current-password" required autoFocus={!!state.username} />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
