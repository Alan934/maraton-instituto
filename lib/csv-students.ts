import { parseDni } from "./dni";

export type ParsedStudent = { dni: string; lastName: string; firstName: string; course: string | null };
export type ParseResult = { students: ParsedStudent[]; errors: string[] };

/** Decodifica el archivo: UTF-8 y, si no es válido (Excel en español), Windows-1252. */
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/**
 * Columnas esperadas: DNI, Apellido, Nombre, Curso (opcional).
 * Separador coma, punto y coma o tabulación. La primera fila puede ser un encabezado.
 */
export function parseStudentsCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const students: ParsedStudent[] = [];
  const errors: string[] = [];
  if (lines.length === 0) return { students, errors: ["El archivo está vacío."] };

  const delimiter = [";", "\t", ","].find((d) => lines[0].includes(d)) ?? ",";
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "").trim());
    const dni = parseDni(cells[0] ?? "");
    if (!dni) {
      if (i === 0) return; // encabezado
      errors.push(`Línea ${i + 1}: DNI inválido ("${(cells[0] ?? "").slice(0, 20)}").`);
      return;
    }
    const lastName = cells[1]?.slice(0, 80);
    const firstName = cells[2]?.slice(0, 80);
    if (!lastName || !firstName) {
      errors.push(`Línea ${i + 1}: faltan apellido o nombre.`);
      return;
    }
    if (seen.has(dni)) {
      errors.push(`Línea ${i + 1}: DNI repetido en el archivo (${dni}).`);
      return;
    }
    seen.add(dni);
    students.push({ dni, lastName, firstName, course: cells[3]?.slice(0, 40) || null });
  });

  return { students, errors };
}
