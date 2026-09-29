"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireSuperadmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { FormState } from "@/components/form-bits";

const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(100);

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre completo.").max(80),
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres.")
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/, "El usuario solo puede tener letras, números, punto, guion y guion bajo."),
  password,
});

export async function createAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperadmin();
  const parsed = createSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fullName, username, password } = parsed.data;

  const exists = await queryOne("SELECT 1 AS x FROM users WHERE lower(username) = lower($1)", [username]);
  if (exists) return { error: `El usuario "${username}" ya existe.` };

  await query(
    "INSERT INTO users (username, full_name, password_hash, role, created_by) VALUES ($1, $2, $3, 'admin', $4)",
    [username, fullName, await hashPassword(password), me.id],
  );
  revalidatePath("/admins");
  return { ok: `Administrador "${fullName}" creado. Ya puede ingresar con su usuario.` };
}

export async function toggleAdmin(formData: FormData) {
  const me = await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id === me.id) return;
  const row = await queryOne<{ active: boolean }>("UPDATE users SET active = NOT active WHERE id = $1 RETURNING active", [id]);
  // Al desactivar se cierran sus sesiones abiertas.
  if (row && !row.active) await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  revalidatePath("/admins");
}

export async function resetPassword(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  const parsed = password.safeParse(formData.get("password"));
  if (!Number.isInteger(id) || !parsed.success) return;
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, await hashPassword(parsed.data)]);
  await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  revalidatePath("/admins");
}
