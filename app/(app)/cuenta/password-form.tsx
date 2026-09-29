"use client";

import { useActionState, useEffect, useRef } from "react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
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
        <input id="current" name="current" type="password" className="input" required autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="next" className="label">Nueva contraseña</label>
        <input id="next" name="next" type="password" className="input" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repetir nueva contraseña</label>
        <input id="confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
      </div>
      <Message state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
