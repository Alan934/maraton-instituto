"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import type { FormState } from "@/components/form-bits";

const nameSchema = z.string().trim().min(1, "Poné el nombre del curso.").max(40, "El nombre es demasiado largo.");

function revalidateAll() {
  revalidatePath("/cursos");
  revalidatePath("/alumnos");
  revalidatePath("/escanear");
}

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSuperadmin();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const exists = await queryOne("SELECT 1 AS x FROM courses WHERE lower(name) = lower($1)", [parsed.data]);
  if (exists) return { error: `El curso "${parsed.data}" ya existe.` };
  await query("INSERT INTO courses (name, created_by) VALUES ($1, $2)", [parsed.data, user.id]);
  revalidateAll();
  return { ok: `Curso "${parsed.data}" creado.` };
}

export async function renameCourse(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!Number.isInteger(id) || !parsed.success) return;
  const clash = await queryOne("SELECT 1 AS x FROM courses WHERE lower(name) = lower($1) AND id <> $2", [parsed.data, id]);
  if (clash) return;
  await withTransaction(async (client) => {
    const old = await client.query("SELECT name FROM courses WHERE id = $1 FOR UPDATE", [id]);
    if (!old.rows[0]) return;
    await client.query("UPDATE courses SET name = $2 WHERE id = $1", [id, parsed.data]);
    await client.query("UPDATE students SET course = $2 WHERE course = $1", [old.rows[0].name, parsed.data]);
  });
  revalidateAll();
}

export async function deleteCourse(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  // Solo se puede borrar un curso sin alumnos.
  await query(
    "DELETE FROM courses c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM students s WHERE s.course = c.name)",
    [id],
  );
  revalidateAll();
}
