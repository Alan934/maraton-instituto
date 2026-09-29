import "server-only";
import { queryOne } from "./db";

/** Devuelve el nombre oficial del curso si existe en la lista (sin distinguir mayúsculas), o null. */
export async function resolveCourse(name: string | null | undefined): Promise<string | null> {
  const v = name?.trim();
  if (!v) return null;
  const row = await queryOne<{ name: string }>("SELECT name FROM courses WHERE lower(name) = lower($1)", [v]);
  return row?.name ?? null;
}
