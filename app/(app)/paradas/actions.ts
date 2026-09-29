"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import type { FormState } from "@/components/form-bits";

const stopSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre para la parada.").max(80, "El nombre es demasiado largo."),
  description: z.string().trim().max(200).optional(),
});

export async function createStop(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSuperadmin();
  const parsed = stopSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await query(
    `INSERT INTO stops (position, name, description, created_by)
     VALUES ((SELECT coalesce(max(position), 0) + 1 FROM stops), $1, $2, $3)`,
    [parsed.data.name, parsed.data.description || null, user.id],
  );
  revalidatePath("/paradas");
  return { ok: `Parada "${parsed.data.name}" creada.` };
}

export async function updateStop(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  const parsed = stopSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!Number.isInteger(id) || !parsed.success) return;
  await query("UPDATE stops SET name = $2, description = $3 WHERE id = $1", [id, parsed.data.name, parsed.data.description || null]);
  revalidatePath("/paradas");
}

export async function moveStop(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  const dir = formData.get("dir") === "up" ? "up" : "down";
  if (!Number.isInteger(id)) return;
  await withTransaction(async (client) => {
    const cur = (await client.query("SELECT id, position FROM stops WHERE id = $1", [id])).rows[0];
    if (!cur) return;
    const neighbor = (
      await client.query(
        dir === "up"
          ? "SELECT id, position FROM stops WHERE position < $1 ORDER BY position DESC LIMIT 1"
          : "SELECT id, position FROM stops WHERE position > $1 ORDER BY position ASC LIMIT 1",
        [cur.position],
      )
    ).rows[0];
    if (!neighbor) return;
    // La restricción única es diferida: el intercambio se valida recién al confirmar.
    await client.query("UPDATE stops SET position = $2 WHERE id = $1", [cur.id, neighbor.position]);
    await client.query("UPDATE stops SET position = $2 WHERE id = $1", [neighbor.id, cur.position]);
  });
  revalidatePath("/paradas");
}

export async function toggleStop(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await query("UPDATE stops SET active = NOT active WHERE id = $1", [id]);
  revalidatePath("/paradas");
}

export async function deleteStop(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const used = await queryOne("SELECT 1 AS x FROM scans WHERE stop_id = $1 LIMIT 1", [id]);
  if (used) return; // con registros solo se puede desactivar
  await withTransaction(async (client) => {
    await client.query("DELETE FROM stops WHERE id = $1", [id]);
    // Se vuelven a numerar 1..N para que no queden huecos.
    await client.query(
      `UPDATE stops s SET position = r.rn
         FROM (SELECT id, row_number() OVER (ORDER BY position) AS rn FROM stops) r
        WHERE r.id = s.id AND s.position <> r.rn`,
    );
  });
  revalidatePath("/paradas");
}
