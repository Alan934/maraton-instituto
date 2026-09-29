import type { Metadata } from "next";
import Link from "next/link";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Escanear" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const user = await getCurrentUser();
  const [stops, courseRows] = await Promise.all([
    query<{ id: number; position: number; name: string }>(`SELECT id, position, name FROM stops WHERE active ORDER BY position`),
    query<{ course: string }>(`SELECT DISTINCT course FROM students WHERE course IS NOT NULL AND course <> '' ORDER BY course`),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Escanear alumnos</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Cada escaneo queda registrado con la hora exacta (Mendoza) y tu usuario.
        </p>
      </div>

      {stops.length === 0 ? (
        <div className="card card-pad text-center">
          <p className="font-bold">Todavía no hay paradas configuradas.</p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {user?.role === "superadmin" ? (
              <>Creá la primera en <Link href="/paradas" className="font-bold text-brand-600 underline">Paradas</Link>.</>
            ) : (
              "Pedile al superadministrador que las cargue."
            )}
          </p>
        </div>
      ) : (
        <Scanner stops={stops} courses={courseRows.map((r) => r.course)} />
      )}
    </div>
  );
}
