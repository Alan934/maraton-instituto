"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { resolveCourse } from "@/lib/courses";
import { decodeCsv, parseStudentsCsv } from "@/lib/csv-students";
import { pool, query, queryOne } from "@/lib/db";
import { parseDni } from "@/lib/dni";
import type { FormState } from "@/components/form-bits";

const studentSchema = z.object({
  dni: z.string().transform((v) => parseDni(v)).pipe(z.string({ error: "DNI inválido (debe tener entre 6 y 9 dígitos)." })),
  lastName: z.string().trim().min(1, "Falta el apellido.").max(80),
  firstName: z.string().trim().min(1, "Falta el nombre.").max(80),
  course: z.string().trim().max(40).optional(),
});

export async function createStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSuperadmin();
  const parsed = studentSchema.safeParse({
    dni: formData.get("dni") ?? "",
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    course: formData.get("course") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { dni, lastName, firstName } = parsed.data;
  const course = await resolveCourse(parsed.data.course);
  if (parsed.data.course && !course) return { error: "Ese curso no existe. Crealo primero en Cursos." };

  const exists = await queryOne("SELECT 1 AS x FROM students WHERE dni = $1", [dni]);
  if (exists) return { error: `Ya existe un alumno con el DNI ${dni}.` };
  await query("INSERT INTO students (dni, first_name, last_name, course, created_by) VALUES ($1, $2, $3, $4, $5)", [
    dni, firstName, lastName, course || null, user.id,
  ]);
  revalidatePath("/alumnos");
  return { ok: `Alumno ${lastName}, ${firstName} agregado.` };
}

export async function importStudents(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSuperadmin();
  const file = formData.get("file");
  const pasted = String(formData.get("text") ?? "");

  let text = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { error: "El archivo es demasiado grande (máx. 2 MB)." };
    text = decodeCsv(await file.arrayBuffer());
  }
  if (!text.trim()) return { error: "Elegí un archivo o pegá el listado." };

  const { students, errors } = parseStudentsCsv(text);
  if (students.length === 0) return { error: errors.slice(0, 5).join(" ") || "No se encontraron alumnos para importar." };

  let inserted = 0;
  let updated = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Los cursos nuevos del listado se agregan a la lista y se unifican con los existentes (sin distinguir mayúsculas).
    const known = new Map<string, string>();
    for (const c of (await client.query("SELECT name FROM courses")).rows) known.set(c.name.toLowerCase(), c.name);
    for (const s of students) {
      if (!s.course) continue;
      const key = s.course.toLowerCase();
      if (!known.has(key)) {
        await client.query("INSERT INTO courses (name, created_by) VALUES ($1, $2) ON CONFLICT DO NOTHING", [s.course, user.id]);
        known.set(key, s.course);
      }
      s.course = known.get(key)!;
    }
    for (const s of students) {
      const res = await client.query(
        `INSERT INTO students (dni, first_name, last_name, course, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dni) DO UPDATE
           SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
               course = COALESCE(EXCLUDED.course, students.course)
         RETURNING (xmax = 0) AS inserted`,
        [s.dni, s.firstName, s.lastName, s.course, user.id],
      );
      if (res.rows[0].inserted) inserted++;
      else updated++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("import error", err);
    return { error: "Ocurrió un error al importar. No se guardó nada." };
  } finally {
    client.release();
  }

  revalidatePath("/alumnos");
  const skipped = errors.length ? ` ${errors.length} líneas omitidas: ${errors.slice(0, 3).join(" ")}${errors.length > 3 ? " …" : ""}` : "";
  return { ok: `Importación lista: ${inserted} nuevos, ${updated} actualizados.${skipped}` };
}

export async function updateStudent(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  const parsed = studentSchema.safeParse({
    dni: formData.get("dni") ?? "",
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    course: formData.get("course") || undefined,
  });
  if (!Number.isInteger(id) || !parsed.success) return;
  const { dni, lastName, firstName } = parsed.data;
  const course = await resolveCourse(parsed.data.course);
  if (parsed.data.course && !course) return;
  const clash = await queryOne("SELECT 1 AS x FROM students WHERE dni = $1 AND id <> $2", [dni, id]);
  if (clash) return;
  await query("UPDATE students SET dni = $2, last_name = $3, first_name = $4, course = $5 WHERE id = $1", [id, dni, lastName, firstName, course || null]);
  revalidatePath(`/alumnos/${id}`);
  revalidatePath("/alumnos");
}

export async function deleteStudent(formData: FormData) {
  await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const used = await queryOne("SELECT 1 AS x FROM scans WHERE student_id = $1 LIMIT 1", [id]);
  if (used) return; // con registros (aun anulados) se conserva el historial
  await query("DELETE FROM students WHERE id = $1", [id]);
  revalidatePath("/alumnos");
  redirect("/alumnos");
}

/** Quita una etapa (parada) a un alumno: el registro queda anulado, no se borra del historial. */
export async function removeStage(formData: FormData) {
  const user = await requireSuperadmin();
  const scanId = Number(formData.get("scanId"));
  if (!Number.isInteger(scanId) || scanId <= 0) return;
  const row = await queryOne<{ student_id: number }>(
    "UPDATE scans SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING student_id",
    [scanId, user.id],
  );
  if (row) revalidateStudent(row.student_id);
}

/** Quita todas las etapas de un alumno (reinicia su recorrido). */
export async function resetStages(formData: FormData) {
  const user = await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await query("UPDATE scans SET deleted_at = now(), deleted_by = $2 WHERE student_id = $1 AND deleted_at IS NULL", [id, user.id]);
  revalidateStudent(id);
}

function revalidateStudent(id: number) {
  revalidatePath(`/alumnos/${id}`);
  revalidatePath("/alumnos");
  revalidatePath("/registros");
  revalidatePath("/estadisticas");
}
