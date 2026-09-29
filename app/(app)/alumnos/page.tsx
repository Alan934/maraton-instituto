import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatDni } from "@/lib/dni";
import { searchStudentIds } from "@/lib/student-search";
import { formatTime } from "@/lib/time";
import { StudentTools } from "./student-tools";

export const metadata: Metadata = { title: "Alumnos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
type SP = { q?: string; curso?: string; estado?: string; pagina?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const isSuper = user.role === "superadmin";
  const page = Math.max(1, Number(sp.pagina) || 1);

  const where: string[] = ["s.active"];
  const params: unknown[] = [];
  const q = sp.q?.trim();
  const matchIds = q ? await searchStudentIds(q) : null;
  if (matchIds) {
    params.push(matchIds);
    where.push(`s.id = ANY($${params.length}::int[])`);
  }
  if (sp.curso) {
    params.push(sp.curso);
    where.push(`s.course = $${params.length}`);
  }
  if (sp.estado === "sin_iniciar") where.push("coalesce(prog.n, 0) = 0");
  if (sp.estado === "en_curso") where.push("prog.n > 0 AND prog.last_pos < (SELECT max(position) FROM stops WHERE active)");
  if (sp.estado === "completo") where.push("prog.last_pos = (SELECT max(position) FROM stops WHERE active)");

  const LATERAL = `
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS n, max(sc.scanned_at) AS last_at, max(p.position) AS last_pos
        FROM scans sc JOIN stops p ON p.id = sc.stop_id AND p.active
       WHERE sc.student_id = s.id AND sc.deleted_at IS NULL) prog ON true`;
  const whereSql = where.join(" AND ");

  const [rows, count, courses, stopCount] = await Promise.all([
    query<{ id: number; dni: string; first_name: string; last_name: string; course: string | null; n: number | null; last_at: Date | null; last_pos: number | null }>(
      `SELECT s.id, s.dni, s.first_name, s.last_name, s.course, prog.n, prog.last_at, prog.last_pos
         FROM students s ${LATERAL} WHERE ${whereSql}
        ORDER BY ${matchIds ? "array_position($" + (params.length + 1) + "::int[], s.id)," : ""} s.last_name, s.first_name LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      matchIds ? [...params, matchIds] : params,
    ),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM students s ${LATERAL} WHERE ${whereSql}`, params),
    query<{ course: string }>("SELECT name AS course FROM courses ORDER BY name"),
    queryOne<{ n: number; max: number | null }>("SELECT count(*)::int AS n, max(position) AS max FROM stops WHERE active"),
  ]);
  const total = count?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lastPosition = stopCount?.max ?? 0;

  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/alumnos?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Alumnos</h1>
        <p className="text-sm text-[color:var(--muted)]">{total.toLocaleString("es-AR")} alumnos</p>
      </div>

      {isSuper && <StudentTools courses={courses.map((c) => c.course)} />}

      <form method="get" className="card card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="q" className="label">Buscar</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Apellido, nombre o DNI" />
        </div>
        <div>
          <label htmlFor="curso" className="label">Curso</label>
          <select id="curso" name="curso" defaultValue={sp.curso ?? ""} className="input">
            <option value="">Todos</option>
            {courses.map((c) => <option key={c.course} value={c.course}>{c.course}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="label">Estado</label>
          <select id="estado" name="estado" defaultValue={sp.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="sin_iniciar">Sin iniciar</option>
            <option value="en_curso">En curso</option>
            <option value="completo">Completaron</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit"><Search className="size-4" /> Buscar</button>
          <Link href="/alumnos" className="btn btn-ghost">Limpiar</Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Alumno</th><th>DNI</th><th>Curso</th><th>Progreso</th><th>Último registro</th></tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-[color:var(--muted)]">No hay alumnos con estos filtros.</td></tr>
              )}
              {rows.map((s) => {
                const n = s.n ?? 0;
                const done = lastPosition > 0 && s.last_pos === lastPosition;
                return (
                  <tr key={s.id}>
                    <td><Link href={`/alumnos/${s.id}`} className="font-bold hover:underline">{s.last_name}, {s.first_name}</Link></td>
                    <td className="num">{formatDni(s.dni)}</td>
                    <td>{s.course ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-brand-100">
                          <div className="h-full rounded-full bg-sun-500" style={{ width: `${stopCount?.n ? Math.min(100, (n / stopCount.n) * 100) : 0}%` }} />
                        </div>
                        <span className="num text-xs font-bold">{n}/{stopCount?.n ?? 0}</span>
                        {done && <span className="badge badge-ok">Completó</span>}
                        {n === 0 && <span className="badge">Sin iniciar</span>}
                      </div>
                    </td>
                    <td className="num text-[color:var(--muted)]">{s.last_at ? formatTime(s.last_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Paginación">
          {page > 1 ? <Link className="btn btn-ghost btn-sm" href={qs({ pagina: page - 1 })}>← Anterior</Link> : <span />}
          <span className="text-sm font-semibold text-[color:var(--muted)]">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-ghost btn-sm" href={qs({ pagina: page + 1 })}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
