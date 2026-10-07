import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flag, Gauge, Medal, Search, Timer, Trophy, Users } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireUser } from "@/lib/auth";
import { formatDni } from "@/lib/dni";
import { getCourseRanking, getRanking, getRankingCourses, getRankingSummary, type RankingFilters } from "@/lib/ranking";
import { formatDate, formatDuration, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ranking por tiempo" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SP = { q?: string; curso?: string; estado?: string; fecha?: string; orden?: string; pagina?: string };

const STATUS_LABEL = { completed: "Completaron", running: "En carrera", all: "Todos los que largaron" } as const;

export default async function RankingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [, sp] = await Promise.all([requireUser(), searchParams]);

  const status = sp.estado === "running" || sp.estado === "all" ? sp.estado : "completed";
  const order = sp.orden === "slowest" ? "slowest" : "fastest";
  const filters: RankingFilters = { q: sp.q, course: sp.curso || undefined, status, date: sp.fecha, order };
  const requested = Math.max(1, Math.trunc(Number(sp.pagina)) || 1);

  const [first, summary, byCourse, courses] = await Promise.all([
    getRanking(filters, PAGE_SIZE, (requested - 1) * PAGE_SIZE),
    getRankingSummary(filters.course),
    getCourseRanking(),
    getRankingCourses(),
  ]);
  const pages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const { rows } = page === requested ? first : await getRanking(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const from = first.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, first.total);

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    const s = p.toString();
    return `/estadisticas/ranking${s ? `?${s}` : ""}`;
  };
  const hasFilters = Boolean(sp.q || sp.curso || sp.fecha || sp.estado || sp.orden);
  const scope = filters.course ?? "todos los cursos";
  const ranked = status !== "running";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/estadisticas" className="mb-1 inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
            <ArrowLeft className="size-4" /> Estadísticas
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Ranking por tiempo</h1>
          <p className="text-sm text-[color:var(--muted)]">
            {summary.stages ? (
              <>Tiempo entre la etapa inicial (<b>{summary.stages.start}</b>) y la final (<b>{summary.stages.end}</b>) · </>
            ) : (
              <>Se necesitan al menos dos paradas activas para medir tiempos · </>
            )}
            Horario de Mendoza
          </p>
        </div>
        <AutoRefresh seconds={15} />
      </div>

      {/* Resumen del curso elegido */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Largaron" value={`${summary.started} / ${summary.students}`} hint={scope === "todos los cursos" ? "de todos los alumnos" : scope} />
        <Kpi icon={Trophy} label="Completaron" value={String(summary.finished)} hint={`${summary.started ? Math.round((summary.finished / summary.started) * 100) : 0}% de los que largaron`} tone="sun" />
        <Kpi icon={Medal} label="Mejor tiempo" value={formatDuration(summary.fastest)} hint={summary.avg != null ? `Promedio ${formatDuration(summary.avg)}` : "Aún nadie llegó"} tone="brand" />
        <Kpi
          icon={Flag}
          label="Hora de largada"
          value={summary.firstStartAt ? formatTime(summary.firstStartAt) : "—"}
          hint={
            summary.firstStartAt && summary.lastStartAt && summary.lastStartAt !== summary.firstStartAt
              ? `última largada ${formatTime(summary.lastStartAt)}`
              : summary.firstStartAt
                ? formatDate(summary.firstStartAt)
                : "Sin largada"
          }
        />
      </section>

      {/* Filtros */}
      <form method="get" className="card card-pad grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="q" className="label">Alumno o DNI</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Apellido, nombre o DNI" />
        </div>
        <div>
          <label htmlFor="curso" className="label">Curso</label>
          <select id="curso" name="curso" defaultValue={sp.curso ?? ""} className="input">
            <option value="">Todos</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="label">Estado</label>
          <select id="estado" name="estado" defaultValue={status} className="input">
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fecha" className="label">Día de llegada</label>
          <input id="fecha" name="fecha" type="date" defaultValue={sp.fecha} className="input min-w-0 appearance-none" />
        </div>
        <div>
          <label htmlFor="orden" className="label">Orden</label>
          <select id="orden" name="orden" defaultValue={order} className="input">
            <option value="fastest">Más rápidos primero</option>
            <option value="slowest">Más lentos primero</option>
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button className="btn btn-primary flex-1 lg:flex-none" type="submit"><Search className="size-4" /> Filtrar</button>
          {hasFilters && <Link href="/estadisticas/ranking" className="btn btn-ghost">Limpiar</Link>}
        </div>
      </form>

      {/* Ranking */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Medal className="size-5 text-sun-600" /> {STATUS_LABEL[status]} · {scope}
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            {first.total === 0 ? "Sin resultados" : `Mostrando ${from}–${to} de ${first.total.toLocaleString("es-AR")}`}
          </p>
        </div>

        <ul className="space-y-3 md:hidden">
          {rows.length === 0 && <li className="card card-pad py-10 text-center text-[color:var(--muted)]">No hay alumnos con estos filtros.</li>}
          {rows.map((r) => (
            <li key={r.studentId} className="card card-pad flex items-start gap-3">
              {ranked && <RankBadge rank={r.rank} />}
              <div className="min-w-0 flex-1">
                <Link href={`/alumnos/${r.studentId}`} className="block break-words font-bold hover:underline">{r.name}</Link>
                <span className="num text-xs text-[color:var(--muted)]">DNI {formatDni(r.dni)}{r.course ? ` · ${r.course}` : ""}</span>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="font-bold uppercase text-[color:var(--muted)]">Largada</dt><dd className="num font-bold">{formatTime(r.startedAt)}</dd></div>
                  <div><dt className="font-bold uppercase text-[color:var(--muted)]">Llegada</dt><dd className="num font-bold">{r.finishedAt ? formatTime(r.finishedAt) : "—"}</dd></div>
                  <div><dt className="font-bold uppercase text-[color:var(--muted)]">Diferencia</dt><dd className="num font-extrabold">{r.durationSeconds != null ? formatDuration(r.durationSeconds) : "En carrera"}</dd></div>
                </dl>
              </div>
            </li>
          ))}
        </ul>

        <div className="card hidden overflow-hidden md:block">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {ranked && <th>Puesto</th>}<th>Alumno</th><th>Curso</th>
                  <th>Etapa inicial · largada</th><th>Etapa final · llegada</th><th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={ranked ? 6 : 5} className="py-10 text-center text-[color:var(--muted)]">No hay alumnos con estos filtros.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    {ranked && <td><RankBadge rank={r.rank} /></td>}
                    <td>
                      <Link href={`/alumnos/${r.studentId}`} className="font-bold hover:underline">{r.name}</Link>
                      <span className="num block text-xs text-[color:var(--muted)]">DNI {formatDni(r.dni)}</span>
                    </td>
                    <td>{r.course ?? <span className="text-[color:var(--muted)]">—</span>}</td>
                    <td className="num whitespace-nowrap">
                      <span className="font-semibold">{formatTime(r.startedAt)}</span>
                      <span className="block text-xs text-[color:var(--muted)]">{formatDate(r.startedAt)}</span>
                    </td>
                    <td className="num whitespace-nowrap">
                      {r.finishedAt ? (
                        <>
                          <span className="font-semibold">{formatTime(r.finishedAt)}</span>
                          <span className="block text-xs text-[color:var(--muted)]">{formatDate(r.finishedAt)}</span>
                        </>
                      ) : (
                        <span className="text-[color:var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="num whitespace-nowrap text-base font-extrabold">
                      {r.durationSeconds != null ? formatDuration(r.durationSeconds) : <span className="badge badge-sun">En carrera</span>}
                    </td>
                  </tr>
                ))}
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
      </section>

      {/* Comparativa por curso */}
      <section className="card card-pad">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold"><Gauge className="size-5 text-brand-600" /> Tiempos por curso</h2>
        <p className="mb-3 text-sm text-[color:var(--muted)]">Ordenados por tiempo promedio. Tocá un curso para ver su ranking.</p>
        {byCourse.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Todavía no hay alumnos cargados.</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Curso</th><th>Largaron</th><th>Completaron</th><th>Mejor tiempo</th><th>Promedio</th><th>Mediana</th></tr>
              </thead>
              <tbody>
                {byCourse.map((c) => (
                  <tr key={c.course} className={c.course === filters.course ? "bg-sun-100" : ""}>
                    <td className="font-bold">
                      <Link href={qs({ curso: c.course, pagina: undefined })} className="hover:underline">{c.course}</Link>
                    </td>
                    <td className="num">{c.started} / {c.students}</td>
                    <td className="num">{c.finished}</td>
                    <td className="num font-bold">{formatDuration(c.fastest)}</td>
                    <td className="num">{formatDuration(c.avg)}</td>
                    <td className="num">{formatDuration(c.median)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[color:var(--muted)]"><Timer className="size-4" aria-label="En carrera" /></span>;
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${rank <= 3 ? "bg-sun-400 text-navy-950" : "bg-brand-100 text-brand-700"}`}>
      {rank}
    </span>
  );
}

function Kpi({
  icon: Icon, label, value, hint, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "sun";
}) {
  const bg = tone === "brand" ? "bg-brand-600 text-white" : tone === "sun" ? "bg-sun-300 text-navy-950" : "bg-white";
  const sub = tone === "brand" ? "text-brand-100" : "text-[color:var(--muted)]";
  return (
    <div className={`card p-4 ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 opacity-80" />
        <p className={`text-xs font-bold uppercase tracking-wide ${sub}`}>{label}</p>
      </div>
      <p className="num mt-1 text-3xl font-extrabold leading-none">{value}</p>
      {hint && <p className={`mt-1.5 text-xs font-semibold ${sub}`}>{hint}</p>}
    </div>
  );
}
