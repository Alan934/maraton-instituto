"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileUp, Flag, RotateCcw, UserPlus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Message, SubmitButton, type FormState } from "@/components/form-bits";
import { createStudent, importStudents, resetCourse, resetMarathon, startMarathon } from "./actions";

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

/** Largada: carga la primera parada a todos los alumnos inscriptos que todavía no iniciaron. */
export function StartMarathon({ pending, firstStop }: { pending: number; firstStop: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(startMarathon, {});
  return (
    <form action={action} className="card card-pad flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Flag className="size-5 text-brand-600" /> Iniciar maratón</h2>
        <p className="text-sm text-[color:var(--muted)]">
          {!firstStop
            ? "Primero creá una parada activa para poder largar."
            : pending > 0
              ? `${pending.toLocaleString("es-AR")} alumnos inscriptos sin iniciar. Se los carga en la primera parada: “${firstStop}”.`
              : "Todos los alumnos inscriptos ya iniciaron."}
        </p>
        <Message state={state} />
      </div>
      {firstStop && pending > 0 && (
        <ConfirmButton
          className="btn btn-primary"
          message={`¿Iniciar la maratón? Se registrará la largada en "${firstStop}" para ${pending} alumnos sin iniciar, con la hora actual.`}
        >
          <Flag className="size-4" /> Iniciar maratón
        </ConfirmButton>
      )}
    </form>
  );
}

/** Reinicio: deja a todos (o a un curso) sin iniciar. Los registros se anulan, no se borran. */
export function ResetTools({ courses, activeScans }: { courses: string[]; activeScans: number }) {
  const [allState, allAction] = useActionState<FormState, FormData>(resetMarathon, {});
  const [courseState, courseAction] = useActionState<FormState, FormData>(resetCourse, {});
  return (
    <section className="card card-pad space-y-4 border-red-200">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><RotateCcw className="size-5 text-red-600" /> Reiniciar</h2>
        <p className="text-sm text-[color:var(--muted)]">
          Los registros se anulan (quedan en Registros como anulados) y los alumnos vuelven a “Sin iniciar”. Para un solo alumno, entrá a su ficha y usá “Reiniciar recorrido”.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={allAction} className="space-y-2">
          <p className="label">Toda la maratón</p>
          <ConfirmButton
            className="btn btn-danger"
            message={`¿Reiniciar TODA la maratón? Se anularán ${activeScans} registros de todos los alumnos y tendrán que largar de nuevo.`}
          >
            <RotateCcw className="size-4" /> Reiniciar toda la maratón
          </ConfirmButton>
          <Message state={allState} />
        </form>
        <form action={courseAction} className="space-y-2">
          <label htmlFor="r-course" className="label">Un curso</label>
          <div className="flex flex-wrap gap-2">
            <select id="r-course" name="course" className="input w-auto min-w-40 flex-1" defaultValue="" required>
              <option value="" disabled>Elegí un curso</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ConfirmButton className="btn btn-danger" message="¿Reiniciar el recorrido de todos los alumnos de este curso?">
              <RotateCcw className="size-4" /> Reiniciar curso
            </ConfirmButton>
          </div>
          <Message state={courseState} />
        </form>
      </div>
    </section>
  );
}
