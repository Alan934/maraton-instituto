"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { createCourse } from "./actions";

export function CourseForm() {
  const [state, action] = useActionState<FormState, FormData>(createCourse, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card card-pad space-y-3">
      <h2 className="text-lg font-extrabold">Nuevo curso</h2>
      <div>
        <label htmlFor="name" className="label">Nombre</label>
        <input id="name" name="name" className="input" placeholder="Ej: 3°A" required maxLength={40} autoComplete="off" />
      </div>
      <Message state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Creando…"><Plus className="size-4" /> Crear curso</SubmitButton>
    </form>
  );
}
