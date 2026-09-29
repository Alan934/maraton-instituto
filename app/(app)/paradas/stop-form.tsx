"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { createStop } from "./actions";

export function StopForm() {
  const [state, action] = useActionState<FormState, FormData>(createStop, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card card-pad space-y-3">
      <h2 className="text-lg font-extrabold">Nueva parada</h2>
      <p className="text-xs text-[color:var(--muted)]">Se agrega al final del recorrido. Después podés reordenarla.</p>
      <div>
        <label htmlFor="name" className="label">Nombre</label>
        <input id="name" name="name" className="input" placeholder="Ej: Plaza principal" required maxLength={80} />
      </div>
      <div>
        <label htmlFor="description" className="label">Descripción (opcional)</label>
        <input id="description" name="description" className="input" placeholder="Ej: Frente al banco" maxLength={200} />
      </div>
      <Message state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Creando…"><Plus className="size-4" /> Crear parada</SubmitButton>
    </form>
  );
}
