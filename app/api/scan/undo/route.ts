import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { queryOne } from "@/lib/db";

/** Anula un registro recién cargado: el propio admin dentro de 5 minutos, o el superadmin siempre. */
export async function POST(request: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ ok: false, message: "Origen no permitido." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sesión vencida." }, { status: 401 });

  const parsed = z.object({ scanId: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Solicitud inválida." }, { status: 400 });

  const row = await queryOne(
    `UPDATE scans SET deleted_at = now(), deleted_by = $2
      WHERE id = $1 AND deleted_at IS NULL
        AND ($3::boolean OR (scanned_by = $2 AND clock_timestamp() - scanned_at < interval '5 minutes'))
      RETURNING id`,
    [parsed.data.scanId, user.id, user.role === "superadmin"],
  );
  if (!row) return NextResponse.json({ ok: false, message: "No se pudo anular (pasó el tiempo permitido o no es tu registro)." });
  return NextResponse.json({ ok: true });
}
