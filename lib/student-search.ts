import "server-only";
import Fuse from "fuse.js";
import { query } from "./db";

type Item = { id: number; dni: string; name: string; reversed: string };

/**
 * Búsqueda difusa de alumnos (tolera errores de tipeo, tildes y orden de nombre/apellido).
 * Devuelve los ids ordenados por relevancia. Si la búsqueda es numérica se busca dentro del DNI.
 */
export async function searchStudentIds(q: string, limit = 2000): Promise<number[]> {
  const text = q.trim();
  if (!text) return [];
  const rows = await query<{ id: number; dni: string; first_name: string; last_name: string }>(
    "SELECT id, dni, first_name, last_name FROM students",
  );

  const digits = text.replace(/[.\s-]/g, "");
  if (/^\d{3,}$/.test(digits)) {
    return rows.filter((r) => r.dni.includes(digits)).slice(0, limit).map((r) => r.id);
  }

  const items: Item[] = rows.map((r) => ({
    id: r.id,
    dni: r.dni,
    name: `${r.last_name} ${r.first_name}`,
    reversed: `${r.first_name} ${r.last_name}`,
  }));
  const fuse = new Fuse(items, {
    keys: ["name", "reversed"],
    threshold: 0.35,
    ignoreLocation: true,
    ignoreDiacritics: true,
    minMatchCharLength: 2,
  });
  return fuse.search(text, { limit }).map((r) => r.item.id);
}
