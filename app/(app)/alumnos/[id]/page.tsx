import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Circle, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatDni } from "@/lib/dni";
import { formatDateTime, formatDuration } from "@/lib/time";
import { deleteStudent, updateStudent } from "../actions";

export const metadata: Metadata = { title: "Alumno" };
export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id: idParam }] = await Promise.all([requireUser(), params]);
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();

  const student = await queryOne<{
    id: number; dni: string; first_name: string; last_name: string; course: string | null;
    created_at: Date; created_by_name: string | null;
  }>(
    `SELECT s.*, u.full_name AS created_by_name FROM students s LEFT JOIN users u ON u.id = s.created_by WHERE s.id = $1`,
    [id],
  );
  if (!student) notFound();

  const [timeline, anyScans] = await Promise.all([
    query<{
      stop_id: number; position: number; name: string; active: boolean; scan_id: number | null; scanned_at: Date | null;
      scanned_by: string | null; method: string | null; skipped_previous: boolean | null;
    }>(
      `SELECT p.id AS stop_id, p.position, p.name, p.active, sc.id AS scan_id, sc.scanned_at, u.full_name AS scanned_by,
              sc.method, sc.skipped_previous
         FROM stops p
         LEFT JOIN scans sc ON sc.stop_id = p.id AND sc.student_id = $1 AND sc.deleted_at IS NULL
         LEFT JOIN users u ON u.id = sc.scanned_by
        WHERE p.active OR sc.id IS NOT NULL
        ORDER BY p.position`,
      [id],
    ),
    queryOne("SELECT 1 AS x FROM scans WHERE student_id = $1 LIMIT 1", [id]),
  ]);

  const passed = timeline.filter((t) => t.scanned_at);
  const first = passed[0]?.scanned_at;
  const last = passed.at(-1)?.scanned_at;
  const isSuper = user.role === "superadmin";

  return (
    <div className="space-y-5">
      <Link href="/alumnos" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:underline">
        <ArrowLeft className="size-4" /> Volver a alumnos
      </Link>

      <div className="card card-pad">
        <h1 className="text-2xl font-extrabold tracking-tight">{student.last_name}, {student.first_name}</h1>
        <p className="text-sm text-[color:var(--muted)]">
          DNI {formatDni(student.dni)}{student.course ? ` · ${student.course}` : ""} · Alta {formatDateTime(student.created_at)}
          {student.created_by_name ? ` por ${student.created_by_name}` : ""}
        </p>
        {first && last && passed.length > 1 && (
          <p className="mt-2 text-sm">
            Tiempo entre la primera y la última parada: <b className="num">{formatDuration((last.getTime() - first.getTime()) / 1000)}</b>
          </p>
        )}
      </div>

      <section className="card card-pad">
        <h2 className="mb-4 text-lg font-extrabold">Recorrido</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No hay paradas configuradas.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-brand-200 pl-6">
            {timeline.map((t, i) => {
              const prev = i > 0 ? timeline[i - 1].scanned_at : null;
              return (
                <li key={t.stop_id} className="relative">
                  <span className={`absolute -left-[2.15rem] grid size-6 place-items-center rounded-full ${t.scanned_at ? "bg-emerald-600 text-white" : "bg-brand-100 text-brand-400"}`}>
                    {t.scanned_at ? <Check className="size-3.5" /> : <Circle className="size-3" />}
                  </span>
                  <p className="font-bold">
                    Parada {t.position} · {t.name}
                    {!t.active && <span className="badge ml-2">Desactivada</span>}
                    {t.skipped_previous && <span className="badge badge-sun ml-2">salteó paradas</span>}
                  </p>
                  {t.scanned_at ? (
                    <p className="text-sm text-[color:var(--muted)]">
                      <span className="num font-semibold text-navy-900">{formatDateTime(t.scanned_at)}</span>
                      {t.scanned_by ? ` · cargó ${t.scanned_by}` : ""}
                      {prev && t.scanned_at > prev ? ` · +${formatDuration((t.scanned_at.getTime() - prev.getTime()) / 1000)} desde la anterior` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-[color:var(--muted)]">Pendiente</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {isSuper && (
        <section className="card card-pad space-y-4">
          <h2 className="text-lg font-extrabold">Editar datos</h2>
          <form action={updateStudent} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <input type="hidden" name="id" value={student.id} />
            <div><label htmlFor="e-dni" className="label">DNI</label><input id="e-dni" name="dni" defaultValue={student.dni} className="input num" required /></div>
            <div><label htmlFor="e-last" className="label">Apellido</label><input id="e-last" name="lastName" defaultValue={student.last_name} className="input" required /></div>
            <div><label htmlFor="e-first" className="label">Nombre</label><input id="e-first" name="firstName" defaultValue={student.first_name} className="input" required /></div>
            <div><label htmlFor="e-course" className="label">Curso</label><input id="e-course" name="course" defaultValue={student.course ?? ""} className="input" /></div>
            <div className="flex items-end"><button className="btn btn-primary">Guardar</button></div>
          </form>
          {!anyScans && (
            <form action={deleteStudent}>
              <input type="hidden" name="id" value={student.id} />
              <ConfirmButton message={`¿Eliminar a ${student.last_name}, ${student.first_name}? Esta acción no se puede deshacer.`}>
                <Trash2 className="size-4" /> Eliminar alumno
              </ConfirmButton>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
