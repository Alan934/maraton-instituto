/**
 * Extrae el número de DNI de lo que devuelve un lector.
 * Acepta: solo números (con o sin puntos), Code 39/128 con asteriscos, y el PDF417 del
 * DNI argentino ("@trámite@apellido@nombre@sexo@dni@ejemplar@...").
 * Devuelve null si no parece un DNI (6 a 9 dígitos).
 */
export function parseDni(raw: string): string | null {
  if (!raw) return null;
  const text = raw.trim();

  if (text.includes("@")) {
    const parts = text.split("@").map((p) => p.trim());
    const candidate = parts[4]?.replace(/\D/g, "");
    if (candidate && candidate.length >= 6 && candidate.length <= 9) return normalize(candidate);
    const group = parts.find((p) => /^\d{7,8}$/.test(p));
    if (group) return normalize(group);
  }

  const onlyDigits = text.replace(/[.\s*-]/g, "");
  if (/^\d{6,9}$/.test(onlyDigits)) return normalize(onlyDigits);

  const match = text.match(/\d{7,8}/);
  return match ? normalize(match[0]) : null;
}

function normalize(digits: string) {
  const d = digits.replace(/^0+/, "");
  return d.length >= 6 ? d : null;
}

export function formatDni(dni: string) {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
