"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileUp, UserPlus } from "lucide-react";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { createStudent, importStudents } from "./actions";

export function StudentTools({ courses }: { courses: string[] }) {
  const [createState, createAction] = useActionState<FormState, FormData>(createStudent, {});
  const [importState, importAction] = useActionState<FormState, FormData>(importStudents, {});
  const createRef = useRef<HTMLFormElement>(null);
  const importRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (createState.ok) createRef.current?.reset(); }, [createState]);
  useEffect(() => { if (importState.ok) importRef.current?.reset(); }, [importState]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form ref={createRef} action={createAction} className="card card-pad space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><UserPlus className="size-5 text-brand-600" /> Agregar alumno</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="c-dni" className="label">DNI</label>
            <input id="c-dni" name="dni" className="input num" inputMode="numeric" required placeholder="45123456" />
          </div>
          <div>
            <label htmlFor="c-course" className="label">Curso (opcional)</label>
            <select id="c-course" name="course" className="input" defaultValue="">
              <option value="">Sin curso</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="c-last" className="label">Apellido</label>
            <input id="c-last" name="lastName" className="input" required maxLength={80} />
          </div>
          <div>
            <label htmlFor="c-first" className="label">Nombre</label>
            <input id="c-first" name="firstName" className="input" required maxLength={80} />
          </div>
        </div>
        <Message state={createState} />
        <SubmitButton pendingLabel="Guardando…"><UserPlus className="size-4" /> Agregar</SubmitButton>
      </form>

      <form ref={importRef} action={importAction} className="card card-pad space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><FileUp className="size-5 text-brand-600" /> Importar listado</h2>
        <p className="text-sm text-[color:var(--muted)]">
          Columnas: <b>DNI, Apellido, Nombre, Curso</b> (los cursos que no existan se crean solos; separadas por coma, punto y coma o tabulación; podés pegar directo desde Excel). Los DNI que ya existen se actualizan.
        </p>
        <input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" className="input text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:font-bold file:text-brand-700" aria-label="Archivo CSV" />
        <textarea name="text" rows={4} className="input num text-sm" placeholder={"45123456;Pérez;Ana;3° A\n46234567;Gómez;Luis;3° B"} aria-label="Listado pegado" />
        <Message state={importState} />
        <SubmitButton pendingLabel="Importando…"><FileUp className="size-4" /> Importar</SubmitButton>
      </form>
    </div>
  );
}
