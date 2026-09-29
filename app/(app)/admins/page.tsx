import type { Metadata } from "next";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireSuperadmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { AdminForm } from "./admin-form";
import { resetPassword, toggleAdmin } from "./actions";

export const metadata: Metadata = { title: "Administradores" };
export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const me = await requireSuperadmin();
  const users = await query<{
    id: number; username: string; full_name: string; role: string; active: boolean;
    created_at: Date; last_login_at: Date | null; created_by_name: string | null; scans: number; last_scan: Date | null;
  }>(
    `SELECT u.id, u.username, u.full_name, u.role, u.active, u.created_at, u.last_login_at, c.full_name AS created_by_name,
            (SELECT count(*) FROM scans sc WHERE sc.scanned_by = u.id AND sc.deleted_at IS NULL)::int AS scans,
            (SELECT max(scanned_at) FROM scans sc WHERE sc.scanned_by = u.id AND sc.deleted_at IS NULL) AS last_scan
       FROM users u LEFT JOIN users c ON c.id = u.created_by
      ORDER BY u.role DESC, u.active DESC, u.full_name`,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Administradores</h1>
        <p className="text-sm text-[color:var(--muted)]">Ellos escanean alumnos y ven las estadísticas. Todo lo que cargan queda a su nombre.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="card overflow-hidden">
          <ul className="divide-y divide-brand-100">
            {users.map((u) => (
              <li key={u.id} className={`p-4 ${u.active ? "" : "bg-brand-50/70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-tight">
                      {u.full_name}
                      {u.role === "superadmin" ? <span className="badge badge-sun">Superadmin</span> : <span className="badge">Admin</span>}
                      {!u.active && <span className="badge badge-bad">Desactivado</span>}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">@{u.username}</p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      <b className="num text-navy-900">{u.scans}</b> registros{u.last_scan ? ` · último ${formatDateTime(u.last_scan)}` : ""}
                      <br />
                      Último ingreso: {u.last_login_at ? formatDateTime(u.last_login_at) : "nunca"} · Creado {formatDateTime(u.created_at)}
                      {u.created_by_name ? ` por ${u.created_by_name}` : ""}
                    </p>
                  </div>
                  {u.id !== me.id && (
                    <form action={toggleAdmin}>
                      <input type="hidden" name="id" value={u.id} />
                      {u.active ? (
                        <ConfirmButton message={`¿Desactivar a ${u.full_name}? Se cerrarán sus sesiones y no podrá ingresar.`}>
                          <UserX className="size-4" /> Desactivar
                        </ConfirmButton>
                      ) : (
                        <button className="btn btn-ghost btn-sm"><UserCheck className="size-4" /> Reactivar</button>
                      )}
                    </form>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-brand-600">
                    <KeyRound className="size-3.5" /> Cambiar contraseña
                  </summary>
                  <form action={resetPassword} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="password" type="password" minLength={8} required className="input !w-64" placeholder="Nueva contraseña (mín. 8)" autoComplete="new-password" aria-label="Nueva contraseña" />
                    <button className="btn btn-primary btn-sm">Guardar</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </section>
        <AdminForm />
      </div>
    </div>
  );
}
