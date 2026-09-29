"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { PasswordInput } from "@/components/password-input";
import { createAdmin } from "./actions";

export function AdminForm() {
  const [state, action] = useActionState<FormState, FormData>(createAdmin, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card card-pad space-y-3">
      <h2 className="text-lg font-extrabold">Nuevo administrador</h2>
      <div>
        <label htmlFor="fullName" className="label">Nombre completo</label>
        <input id="fullName" name="fullName" className="input" required maxLength={80} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="username" className="label">Usuario</label>
        <input id="username" name="username" className="input" required maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck={false} />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña inicial</label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
        <p className="mt-1 text-xs text-[color:var(--muted)]">Mínimo 8 caracteres. Podrá cambiarla desde “Mi cuenta”.</p>
      </div>
      <Message state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Creando…"><UserPlus className="size-4" /> Crear administrador</SubmitButton>
    </form>
  );
}
