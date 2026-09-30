import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Camera, Flag, Gauge, Hand, Hourglass, Medal, ScanLine, Timer, Trophy, UserCheck, Users, Zap } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireUser } from "@/lib/auth";
import { getStats } from "@/lib/stats";
import { formatDate, formatDateTime, formatDuration, formatTime } from "@/lib/time";
import { formatDni } from "@/lib/dni";

export const metadata: Metadata = { title: "Estadísticas" };
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const [user, { fecha }] = await Promise.all([requireUser(), searchParams]);
  const stats = await getStats(fecha);
  const { overview: o, stops, timeline, courses, finishers, admins, recent } = stats;
  const maxBucket = Math.max(1, ...timeline.buckets.map((b) => b.count));
  const maxPassed = Math.max(1, ...stops.map((s) => s.passed));
  const slowest = stops.reduce<(typeof stops)[number] | null>(
    (m, s) => (s.avgFromPrevSeconds != null && (!m || s.avgFromPrevSeconds > m.avgFromPrevSeconds!) ? s : m), null);
  const maxAvg = Math.max(1, ...stops.map((s) => s.avgFromPrevSeconds ?? 0));
  const methodTotal = o.methods.scanner + o.methods.camera + o.methods.manual;
  const skipPct = pct(o.skippedScans, o.totalScans);
  const seg = (n: number) => `${pct(n, o.totalStudents)}%`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Datos en vivo · Horario de Mendoza · Actualizado {formatTime(stats.generatedAt)}
          </p>
        </div>
        <AutoRefresh seconds={10} />
      </div>

      {/* Progreso general */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">Progreso general</h2>
            <p className="text-sm text-[color:var(--muted)]">Cómo se reparten los {o.totalStudents.toLocaleString("es-AR")} alumnos registrados.</p>
          </div>
          <p className="num text-4xl font-extrabold leading-none text-brand-600">
            {pct(o.finished, o.totalStudents)}%<span className="ml-1.5 text-sm font-bold text-[color:var(--muted)]">completó</span>
          </p>
        </div>
        <div
          className="mt-4 flex h-6 overflow-hidden rounded-full bg-brand-100"
          role="img"
          aria-label={`${o.finished} completaron, ${o.inProgress} en curso, ${o.notStarted} sin empezar`}
        >
          <div className="h-full bg-sun-400 transition-all" style={{ width: seg(o.finished) }} title="Completaron" />
          <div className="h-full bg-brand-500 transition-all" style={{ width: seg(o.inProgress) }} title="En curso" />
        </div>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <Legend color="bg-sun-400" label="Completaron" value={o.finished} note="pasaron por la última parada" />
          <Legend color="bg-brand-500" label="En curso" value={o.inProgress} note="ya empezaron, aún no terminan" />
          <Legend color="bg-brand-100 ring-1 ring-brand-200" label="Sin empezar" value={o.notStarted} note="todavía sin ningún registro" />
        </ul>
      </section>

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Alumnos registrados" value={o.totalStudents} hint="Total en el padrón" />
        <Kpi icon={UserCheck} label="Participando" value={o.started} hint={`${pct(o.started, o.totalStudents)}% del total`} tone="brand" />
        <Kpi icon={Trophy} label="Completaron" value={o.finished} hint={`${pct(o.finished, o.totalStudents)}% del total`} tone="sun" />
        <Kpi
          icon={AlertTriangle}
          label="Paradas salteadas"
          value={o.skippedScans}
          hint={o.skippedScans ? `${skipPct}% de los registros, con alerta` : "Ninguna"}
          tone={o.skippedScans ? "warn" : undefined}
        />
        <Kpi icon={Flag} label="Registros totales" value={o.totalScans} hint={o.lastScanAt ? `Último: ${formatTime(o.lastScanAt)}` : "Sin registros aún"} />
        <Kpi icon={Zap} label="Ritmo (últ. 15 min)" value={o.scansLast15} hint={`${o.scansLast15 * 4} registros/hora al ritmo actual`} />
        <Kpi icon={Gauge} label="Última hora" value={o.scansLastHour} hint="registros en los últimos 60 min" />
        <Kpi
          icon={Hourglass}
          label="Tiempo promedio"
          text={o.finishTimes ? formatDuration(o.finishTimes.avg) : "—"}
          hint={o.finishTimes ? `Mediana ${formatDuration(o.finishTimes.median)}` : "Aún nadie terminó"}
        />
      </section>

      {/* Tiempos de llegada + método */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-1 text-lg font-extrabold">Tiempos de los que completaron</h2>
          <p className="mb-4 text-sm text-[color:var(--muted)]">Desde su primera parada hasta la última.</p>
          {o.finishTimes ? (
            <dl className="grid grid-cols-2 gap-3">
              <TimeBox label="Más rápido" value={formatDuration(o.finishTimes.fastest)} tone="sun" />
              <TimeBox label="Más lento" value={formatDuration(o.finishTimes.slowest)} />
              <TimeBox label="Promedio" value={formatDuration(o.finishTimes.avg)} />
              <TimeBox label="Mediana" value={formatDuration(o.finishTimes.median)} hint="la mitad tardó menos" />
            </dl>
          ) : (
            <p className="py-8 text-center text-sm text-[color:var(--muted)]">Se mostrará cuando el primer alumno complete el recorrido.</p>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="mb-1 text-lg font-extrabold">Cómo se cargan los registros</h2>
          <p className="mb-4 text-sm text-[color:var(--muted)]">Método usado por los administradores.</p>
          {methodTotal === 0 ? (
            <p className="py-8 text-center text-sm text-[color:var(--muted)]">Sin registros aún.</p>
          ) : (
            <div className="space-y-3">
              <MethodRow icon={ScanLine} label="Lector de códigos" n={o.methods.scanner} total={methodTotal} />
              <MethodRow icon={Camera} label="Cámara" n={o.methods.camera} total={methodTotal} />
              <MethodRow icon={Hand} label="Manual (DNI)" n={o.methods.manual} total={methodTotal} />
            </div>
          )}
        </section>
      </div>

      {/* Progreso por parada */}
      <section className="card card-pad">
        <h2 className="mb-1 text-lg font-extrabold">Alumnos por parada</h2>
        <p className="mb-4 text-sm text-[color:var(--muted)]">
          El número grande es cuántos registraron esa parada. Debajo, cuántos están ahí ahora y cuánto tardan en llegar desde la anterior.
        </p>
        {slowest && slowest.avgFromPrevSeconds != null && stops.length > 1 && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-sun-100 px-3 py-2 text-sm font-semibold text-navy-950">
            <Hourglass className="mt-0.5 size-4 shrink-0" />
            <span>
              Tramo más lento: hasta <b>{slowest.name}</b> (parada {slowest.position}), con {formatDuration(slowest.avgFromPrevSeconds)} de promedio.
            </span>
          </p>
        )}
        {stops.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No hay paradas configuradas.</p>
        ) : (
          <ol className="space-y-3">
            {stops.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-extrabold text-sun-300">{s.position}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {s.avgFromPrevSeconds != null ? `Tarda ${formatDuration(s.avgFromPrevSeconds)} desde la parada anterior` : "Sin datos de tiempo aún"}
                    </p>
                  </div>
                  <p className="num text-lg font-extrabold">
                    {s.passed} <span className="text-xs font-bold text-[color:var(--muted)]">({pct(s.passed, o.totalStudents)}%)</span>
                  </p>
                </div>
                <div className="mt-2 pl-11">
                  <div className="h-3 overflow-hidden rounded-full bg-brand-100" role="img" aria-label={`${s.passed} alumnos pasaron por ${s.name}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sun-400" style={{ width: `${(s.passed / maxPassed) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    <b className="num text-navy-900">{s.current}</b> están aquí ahora
                    {s.firstAt && <> · primero {formatTime(s.firstAt)} · último {formatTime(s.lastAt!)}</>}
                  </p>
                  {s.avgFromPrevSeconds != null && (
                    <div className="mt-1.5 flex items-center gap-2" title="Tiempo promedio desde la parada anterior">
                      <Timer className="size-3 shrink-0 text-[color:var(--muted)]" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                        <div
                          className={`h-full rounded-full ${slowest?.id === s.id ? "bg-sun-500" : "bg-navy-900/40"}`}
                          style={{ width: `${(s.avgFromPrevSeconds / maxAvg) * 100}%` }}
                        />
                      </div>
                      <span className="num w-16 text-right text-xs font-bold">{formatDuration(s.avgFromPrevSeconds)}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Actividad por hora */}
        <section className="card card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Registros por hora</h2>
            <form method="get" className="flex items-center gap-2">
              <label htmlFor="fecha" className="sr-only">Fecha</label>
              <select id="fecha" name="fecha" defaultValue={timeline.date} className="input !w-auto !py-1.5 text-sm" >
                {!timeline.availableDates.includes(timeline.date) && <option value={timeline.date}>{formatDate(`${timeline.date}T12:00:00-03:00`)}</option>}
                {timeline.availableDates.map((d) => (
                  <option key={d} value={d}>{formatDate(`${d}T12:00:00-03:00`)}</option>
                ))}
              </select>
              <button className="btn btn-ghost btn-sm" type="submit">Ver</button>
            </form>
          </div>
          {timeline.buckets.length === 0 ? (
            <p className="py-10 text-center text-sm text-[color:var(--muted)]">Sin registros en esta fecha.</p>
          ) : (
            <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Registros por hora">
              {timeline.buckets.map((b) => (
                <div key={b.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-xs font-bold">{b.count || ""}</span>
                  <div
                    className="w-full rounded-t-md bg-brand-500"
                    style={{ height: `${Math.max(2, (b.count / maxBucket) * 78)}%`, opacity: b.count ? 1 : 0.25 }}
                  />
                  <span className="num text-[0.7rem] font-semibold text-[color:var(--muted)]">{String(b.hour).padStart(2, "0")}h</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ranking */}
        <section className="card card-pad">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Medal className="size-5 text-sun-600" /> Los más rápidos</h2>
          {finishers.length === 0 ? (
            <p className="py-10 text-center text-sm text-[color:var(--muted)]">Todavía nadie completó todas las paradas.</p>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>#</th><th>Alumno</th><th>Tiempo total</th><th>Llegada</th></tr></thead>
                <tbody>
                  {finishers.map((f) => (
                    <tr key={f.studentId}>
                      <td>
                        <span className={`grid size-7 place-items-center rounded-full text-sm font-extrabold ${f.rank <= 3 ? "bg-sun-400 text-navy-950" : "bg-brand-100 text-brand-700"}`}>{f.rank}</span>
                      </td>
                      <td>
                        <Link href={`/alumnos/${f.studentId}`} className="font-bold hover:underline">{f.name}</Link>
                        {f.course && <span className="block text-xs text-[color:var(--muted)]">{f.course}</span>}
                      </td>
                      <td className="num font-bold">{formatDuration(f.durationSeconds)}</td>
                      <td className="num text-[color:var(--muted)]">{formatTime(f.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Por curso */}
      <section className="card card-pad">
        <h2 className="mb-3 text-lg font-extrabold">Avance por curso</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Todavía no hay alumnos cargados.</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Curso</th><th>Alumnos</th><th>Participando</th><th>Completaron</th><th>Paradas por alumno</th><th className="min-w-40">Avance</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const progress = o.stopCount > 0 && c.total > 0 ? (c.avgStops / o.stopCount) * 100 : 0;
                  return (
                    <tr key={c.course}>
                      <td className="font-bold">{c.course}</td>
                      <td className="num">{c.total}</td>
                      <td className="num">{c.started} <span className="text-xs text-[color:var(--muted)]">({pct(c.started, c.total)}%)</span></td>
                      <td className="num">{c.finished} <span className="text-xs text-[color:var(--muted)]">({pct(c.finished, c.total)}%)</span></td>
                      <td className="num">{c.avgStops.toFixed(1)} / {o.stopCount}</td>
                      <td>
                        <div className="h-2.5 overflow-hidden rounded-full bg-brand-100">
                          <div className="h-full rounded-full bg-sun-500" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimos registros */}
        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><Timer className="size-5 text-brand-600" /> Últimos registros</h2>
            <Link href="/registros" className="text-sm font-bold text-brand-600 hover:underline">Ver todos</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-[color:var(--muted)]">Todavía no hay registros.</p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {r.studentName}
                      {r.skippedPrevious && <span className="badge badge-sun ml-1.5">salteó</span>}
                    </p>
                    <p className="truncate text-xs text-[color:var(--muted)]">
                      DNI {formatDni(r.dni)} · Parada {r.stopPosition} · {r.adminName ?? "—"}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-bold">{formatTime(r.scannedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Por administrador (solo superadmin) */}
        {user.role === "superadmin" && (
          <section className="card card-pad">
            <h2 className="mb-3 text-lg font-extrabold">Registros por administrador</h2>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Usuario</th><th>Registros</th><th>Primero</th><th>Último</th></tr></thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td className="font-bold">{a.name}{a.role === "superadmin" && <span className="badge badge-sun ml-1.5">Super</span>}</td>
                      <td className="num font-bold">{a.scans}</td>
                      <td className="num text-[color:var(--muted)]">{a.firstAt ? formatDateTime(a.firstAt) : "—"}</td>
                      <td className="num text-[color:var(--muted)]">{a.lastAt ? formatDateTime(a.lastAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, value, note }: { color: string; label: string; value: number; note: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl bg-brand-50 px-3 py-2">
      <span className={`mt-1 size-3 shrink-0 rounded-full ${color}`} />
      <div>
        <p className="font-bold"><span className="num">{value.toLocaleString("es-AR")}</span> {label}</p>
        <p className="text-xs text-[color:var(--muted)]">{note}</p>
      </div>
    </li>
  );
}

function TimeBox({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "sun" }) {
  return (
    <div className={`rounded-xl p-3 ${tone === "sun" ? "bg-sun-300 text-navy-950" : "bg-brand-50"}`}>
      <dt className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">{label}</dt>
      <dd className="num mt-1 text-2xl font-extrabold leading-none">{value}</dd>
      {hint && <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>}
    </div>
  );
}

function MethodRow({ icon: Icon, label, n, total }: { icon: React.ComponentType<{ className?: string }>; label: string; n: number; total: number }) {
  const p = pct(n, total);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-bold"><Icon className="size-4 text-brand-600" /> {label}</span>
        <span className="num font-bold">{n} <span className="text-xs font-semibold text-[color:var(--muted)]">({p}%)</span></span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, text, hint, tone, className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  text?: string;
  hint?: string;
  tone?: "brand" | "sun" | "warn";
  className?: string;
}) {
  const bg = tone === "brand" ? "bg-brand-600 text-white" : tone === "sun" ? "bg-sun-300 text-navy-950" : tone === "warn" ? "bg-sun-100 text-navy-950" : "bg-white";
  const sub = tone === "brand" ? "text-brand-100" : "text-[color:var(--muted)]";
  return (
    <div className={`card p-4 ${bg} ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 opacity-80" />
        <p className={`text-xs font-bold uppercase tracking-wide ${sub}`}>{label}</p>
      </div>
      <p className="num mt-1 text-3xl font-extrabold leading-none">{text ?? (value ?? 0).toLocaleString("es-AR")}</p>
      {hint && <p className={`mt-1.5 text-xs font-semibold ${sub}`}>{hint}</p>}
    </div>
  );
}
