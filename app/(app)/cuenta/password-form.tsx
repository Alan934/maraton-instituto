"use client";

import { useActionState, useEffect, useRef } from "react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { PasswordInput } from "@/components/password-input";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card card-pad space-y-3">
      <h2 className="text-lg font-extrabold">Cambiar contraseña</h2>
      <div>
        <label htmlFor="current" className="label">Contraseña actual</label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="next" className="label">Nueva contraseña</label>
        <PasswordInput id="next" name="next" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repetir nueva contraseña</label>
        <PasswordInput id="confirm" name="confirm" required minLength={8} autoComplete="new-password" />
      </div>
      <Message state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
