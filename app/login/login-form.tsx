"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="username" className="label">Usuario</label>
        <input
          id="username" name="username" className="input" autoComplete="username"
          autoCapitalize="none" spellCheck={false} defaultValue={state.username} required autoFocus
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>
      )}
      <button type="submit" className="btn btn-primary w-full py-3" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
        Ingresar
      </button>
    </form>
  );
}
