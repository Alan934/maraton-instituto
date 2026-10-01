import type { Metadata } from "next";
import Link from "next/link";
import { Download, Search, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDni } from "@/lib/dni";
import { getScanLog } from "@/lib/scan-log";
import { formatDateTime } from "@/lib/time";
import { voidScan } from "./actions";

export const metadata: Metadata = { title: "Registros" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const METHOD_LABEL = { scanner: "Lector", camera: "Cámara", manual: "Manual" } as const;

type SP = { q?: string; parada?: string; admin?: string; fecha?: string; pagina?: string; anulados?: string };

export default async function LogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const isSuper = user.role === "superadmin";
  const page = Math.max(1, Number(sp.pagina) || 1);

  const filters = {
    q: sp.q,
    stopId: Number(sp.parada) || undefined,
    adminId: isSuper ? Number(sp.admin) || undefined : undefined,
    date: sp.fecha,
    voided: isSuper && sp.anulados === "1",
    onlyUserId: isSuper ? undefined : user.id,
  };

  const [{ rows, total }, stops, admins] = await Promise.all([
    getScanLog(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    query<{ id: number; position: number; name: string }>("SELECT id, position, name FROM stops ORDER BY position"),
    isSuper ? query<{ id: number; full_name: string }>("SELECT id, full_name FROM users ORDER BY full_name") : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/registros?${p.toString()}`;
  };
  const exportHref = `/api/export?${new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== "pagina" && v)) as Record<string, string>,
  ).toString()}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Registros</h1>
          <p className="text-sm text-[color:var(--muted)]">
            {isSuper ? "Quién cargó cada dato y cuándo (horario de Mendoza)." : "Los registros que cargaste vos."} · {total.toLocaleString("es-AR")} resultados
          </p>
        </div>
        {isSuper && (
          <a href={exportHref} className="btn btn-ghost btn-sm"><Download className="size-4" /> Exportar CSV</a>
        )}
      </div>

      <form method="get" className="card card-pad grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="q" className="label">Alumno o DNI</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Apellido, nombre o DNI" />
        </div>
        <div>
          <label htmlFor="parada" className="label">Parada</label>
          <select id="parada" name="parada" defaultValue={sp.parada ?? ""} className="input">
            <option value="">Todas</option>
            {stops.map((s) => <option key={s.id} value={s.id}>Parada {s.position} · {s.name}</option>)}
          </select>
        </div>
        {isSuper ? (
          <div>
            <label htmlFor="admin" className="label">Cargado por</label>
            <select id="admin" name="admin" defaultValue={sp.admin ?? ""} className="input">
              <option value="">Todos</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
        ) : <div className="hidden lg:block" />}
        <div>
          <label htmlFor="fecha" className="label">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={sp.fecha} className="input min-w-0 appearance-none" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button className="btn btn-primary flex-1 lg:flex-none" type="submit"><Search className="size-4" /> Filtrar</button>
          <Link href="/registros" className="btn btn-ghost">Limpiar</Link>
        </div>
        {isSuper && (
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2 lg:col-span-5">
            <input type="checkbox" name="anulados" value="1" defaultChecked={sp.anulados === "1"} className="size-4 accent-brand-600" />
            Incluir registros anulados
          </label>
        )}
      </form>

      <ul className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <li className="card card-pad py-10 text-center text-[color:var(--muted)]">No hay registros con estos filtros.</li>
        )}
        {rows.map((r) => (
          <li key={r.id} className={`card card-pad space-y-2 ${r.deletedAt ? "bg-red-50/60 text-[color:var(--muted)]" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/alumnos/${r.studentId}`} className={`block break-words font-bold hover:underline ${r.deletedAt ? "line-through" : ""}`}>{r.studentName}</Link>
                <span className="num text-xs text-[color:var(--muted)]">
                  DNI {formatDni(r.dni)}{r.course ? ` · ${r.course}` : ""}
                </span>
              </div>
              <span className="badge shrink-0">{METHOD_LABEL[r.method]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">Parada {r.stopPosition}</span>
              <span className="text-xs text-[color:var(--muted)]">{r.stopName}</span>
              {r.skippedPrevious && <span className="badge badge-sun">salteó paradas</span>}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
              <span className="num font-semibold">{formatDateTime(r.scannedAt)}</span>
              {isSuper && <span className="truncate">Cargó: {r.adminName ?? "—"}</span>}
            </div>
            {isSuper && (
              <div>
                {r.deletedAt ? (
                  <span className="badge badge-bad max-w-full" title={`Anulado por ${r.deletedBy ?? "—"}`}>Anulado {formatDateTime(r.deletedAt)}</span>
                ) : (
                  <form action={voidScan}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message={`¿Anular el registro de ${r.studentName} en la Parada ${r.stopPosition}?`} title="Anular registro">
                      <Trash2 className="size-4" /><span className="sr-only">Anular</span>
                    </ConfirmButton>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-hidden md:block">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha y hora</th><th>Alumno</th><th>DNI</th><th>Parada</th>
                {isSuper && <th>Cargó</th>}<th>Vía</th>{isSuper && <th className="w-px" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={isSuper ? 7 : 5} className="py-10 text-center text-[color:var(--muted)]">No hay registros con estos filtros.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={r.deletedAt ? "bg-red-50/60 text-[color:var(--muted)]" : ""}>
                  <td className="num whitespace-nowrap font-semibold">{formatDateTime(r.scannedAt)}</td>
                  <td>
                    <Link href={`/alumnos/${r.studentId}`} className={`font-bold hover:underline ${r.deletedAt ? "line-through" : ""}`}>{r.studentName}</Link>
                    {r.course && <span className="block text-xs text-[color:var(--muted)]">{r.course}</span>}
                  </td>
                  <td className="num">{formatDni(r.dni)}</td>
                  <td>
                    <span className="font-semibold">Parada {r.stopPosition}</span>
                    <span className="block text-xs text-[color:var(--muted)]">{r.stopName}</span>
                    {r.skippedPrevious && <span className="badge badge-sun mt-0.5">salteó paradas</span>}
                  </td>
                  {isSuper && <td>{r.adminName ?? "—"}</td>}
                  <td><span className="badge">{METHOD_LABEL[r.method]}</span></td>
                  {isSuper && (
                    <td>
                      {r.deletedAt ? (
                        <span className="badge badge-bad" title={`Anulado por ${r.deletedBy ?? "—"}`}>Anulado {formatDateTime(r.deletedAt)}</span>
                      ) : (
                        <form action={voidScan}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmButton message={`¿Anular el registro de ${r.studentName} en la Parada ${r.stopPosition}?`} title="Anular registro">
                            <Trash2 className="size-4" /><span className="sr-only">Anular</span>
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
                  )}
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
    </div>
  );
}
