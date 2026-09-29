"use server";

import { z } from "zod";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { FormState } from "@/components/form-bits";

const schema = z.object({
  current: z.string().min(1, "Ingresá tu contraseña actual."),
  next: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres.").max(100),
  confirm: z.string(),
});

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ current: formData.get("current"), next: formData.get("next"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.next !== parsed.data.confirm) return { error: "Las contraseñas nuevas no coinciden." };

  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) return { error: "La contraseña actual es incorrecta." };

  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, await hashPassword(parsed.data.next)]);
  return { ok: "Contraseña actualizada." };
}
