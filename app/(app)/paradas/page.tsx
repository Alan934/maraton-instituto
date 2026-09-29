import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireSuperadmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { deleteStop, moveStop, toggleStop, updateStop } from "./actions";
import { StopForm } from "./stop-form";

export const metadata: Metadata = { title: "Paradas" };
export const dynamic = "force-dynamic";

export default async function StopsPage() {
  await requireSuperadmin();
  const stops = await query<{
    id: number; position: number; name: string; description: string | null; active: boolean;
    created_at: Date; created_by_name: string | null; scans: number;
  }>(
    `SELECT p.id, p.position, p.name, p.description, p.active, p.created_at, u.full_name AS created_by_name,
            (SELECT count(*) FROM scans sc WHERE sc.stop_id = p.id AND sc.deleted_at IS NULL)::int AS scans
       FROM stops p LEFT JOIN users u ON u.id = p.created_by
      ORDER BY p.position`,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Paradas</h1>
        <p className="text-sm text-[color:var(--muted)]">
          El orden define cuál es la “siguiente” parada de cada alumno. Las paradas desactivadas se ignoran.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="card overflow-hidden">
          {stops.length === 0 ? (
            <p className="p-8 text-center text-[color:var(--muted)]">Todavía no creaste ninguna parada. Empezá con la del punto de largada.</p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {stops.map((s, i) => (
                <li key={s.id} className={`p-4 ${s.active ? "" : "bg-brand-50/70"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-extrabold ${s.active ? "bg-navy-900 text-sun-300" : "bg-brand-200 text-brand-700"}`}>
                      {s.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-tight">
                        {s.name}
                        {!s.active && <span className="badge">Desactivada</span>}
                      </p>
                      {s.description && <p className="text-sm text-[color:var(--muted)]">{s.description}</p>}
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        {s.scans} registros · creada {formatDateTime(s.created_at)}{s.created_by_name ? ` por ${s.created_by_name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <form action={moveStop}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" />
                        <button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label="Subir"><ArrowUp className="size-4" /></button>
                      </form>
                      <form action={moveStop}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" />
                        <button className="btn btn-ghost btn-sm" disabled={i === stops.length - 1} aria-label="Bajar"><ArrowDown className="size-4" /></button>
                      </form>
                      <form action={toggleStop}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn btn-ghost btn-sm" title={s.active ? "Desactivar" : "Activar"}>
                          {s.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          <span className="hidden sm:inline">{s.active ? "Desactivar" : "Activar"}</span>
                        </button>
                      </form>
                      {s.scans === 0 && (
                        <form action={deleteStop}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton message={`¿Eliminar la parada "${s.name}"?`} title="Eliminar"><Trash2 className="size-4" /></ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                  <details className="mt-3 pl-13">
                    <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-brand-600">
                      <Pencil className="size-3.5" /> Editar datos
                    </summary>
                    <form action={updateStop} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="id" value={s.id} />
                      <input name="name" defaultValue={s.name} className="input" required maxLength={80} aria-label="Nombre" />
                      <input name="description" defaultValue={s.description ?? ""} className="input" maxLength={200} placeholder="Descripción" aria-label="Descripción" />
                      <button className="btn btn-primary">Guardar</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
        <StopForm />
      </div>
    </div>
  );
}
