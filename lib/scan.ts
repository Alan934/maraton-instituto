import "server-only";
import { pool } from "./db";

export type ScanMethod = "scanner" | "camera" | "manual";

export type StopInfo = { id: number; position: number; name: string };
export type PassedStop = StopInfo & { scannedAt: string; scannedBy: string | null };
export type StudentInfo = {
  id: number;
  dni: string;
  firstName: string;
  lastName: string;
  course: string | null;
  passed: PassedStop[];
};

export type ScanRequest = {
  dni: string;
  /** Parada elegida a mano; si falta se usa la siguiente que le corresponde al alumno. */
  stopId?: number | null;
  /** El admin confirmó cargar aunque se saltee paradas. */
  force?: boolean;
  method: ScanMethod;
  /** Momento exacto del escaneo, devuelto por una llamada anterior (para confirmaciones). */
  scannedAt?: string;
  /** Datos para dar de alta al alumno si el DNI no existe. */
  newStudent?: { firstName: string; lastName: string; course?: string | null };
};

export type ScanResult =
  | { status: "ok"; scanId: number; scannedAt: string; student: StudentInfo; stop: StopInfo; skipped: StopInfo[]; nextStop: StopInfo | null; createdStudent: boolean }
  | { status: "unknown_student"; dni: string; scannedAt: string }
  | { status: "skip_warning"; scannedAt: string; student: StudentInfo | null; stop: StopInfo; skipped: StopInfo[]; nextStop: StopInfo | null }
  | { status: "duplicate"; scannedAt: string; student: StudentInfo; stop: StopInfo; previousAt: string; previousBy: string | null }
  | { status: "completed"; scannedAt: string; student: StudentInfo }
  | { status: "no_stops" }
  | { status: "error"; message: string };

const MAX_CLOCK_WINDOW_MS = 15 * 60 * 1000;

type Row = { id: number; position: number; name: string };
type Ctx = {
  now: Date;
  stops: Row[];
  student: { id: number; dni: string; first_name: string; last_name: string; course: string | null; active: boolean } | null;
  passed: { id: number; position: number; name: string; scannedAt: string; scannedBy: string | null }[];
  user_name: string | null;
};

/**
 * Registra el paso de un alumno por una parada.
 * Usa solo dos idas y vueltas a la base (leer contexto + insertar): el índice único
 * (alumno, parada) evita duplicados aun si dos lectores cargan al mismo alumno a la vez.
 */
export async function registerScan(req: ScanRequest, userId: number): Promise<ScanResult> {
  const { rows } = await pool.query<Ctx>(
    `SELECT clock_timestamp() AS now,
            (SELECT coalesce(json_agg(json_build_object('id', id, 'position', position, 'name', name) ORDER BY position), '[]')
               FROM stops WHERE active) AS stops,
            (SELECT row_to_json(x) FROM (SELECT id, dni, first_name, last_name, course, active FROM students WHERE dni = $1) x) AS student,
            (SELECT coalesce(json_agg(json_build_object('id', p.id, 'position', p.position, 'name', p.name,
                                                        'scannedAt', sc.scanned_at, 'scannedBy', u.full_name) ORDER BY p.position), '[]')
               FROM scans sc
               JOIN stops p ON p.id = sc.stop_id
               LEFT JOIN users u ON u.id = sc.scanned_by
              WHERE sc.deleted_at IS NULL AND sc.student_id = (SELECT id FROM students WHERE dni = $1)) AS passed,
            (SELECT full_name FROM users WHERE id = $2) AS user_name`,
    [req.dni, userId],
  );
  const ctx = rows[0];
  const { stops, student: found } = ctx;

  // Momento del escaneo: hora del servidor de base de datos, salvo que el cliente devuelva el que ya
  // se tomó en un primer intento (confirmaciones), dentro de una ventana segura.
  let scannedAt = ctx.now;
  if (req.scannedAt) {
    const t = new Date(req.scannedAt);
    if (!Number.isNaN(t.getTime()) && t.getTime() <= ctx.now.getTime() + 5000 && ctx.now.getTime() - t.getTime() <= MAX_CLOCK_WINDOW_MS) {
      scannedAt = t;
    }
  }
  const scannedAtIso = scannedAt.toISOString();

  if (stops.length === 0) return { status: "no_stops" };
  if (!found && !req.newStudent) return { status: "unknown_student", dni: req.dni, scannedAt: scannedAtIso };
  if (found && !found.active) return { status: "error", message: "El alumno está dado de baja." };

  const toPassed = (p: Ctx["passed"][number]): PassedStop => ({
    id: p.id, position: p.position, name: p.name, scannedAt: new Date(p.scannedAt).toISOString(), scannedBy: p.scannedBy,
  });
  const info: StudentInfo = found
    ? { id: found.id, dni: found.dni, firstName: found.first_name, lastName: found.last_name, course: found.course, passed: ctx.passed.map(toPassed) }
    : {
        id: 0, dni: req.dni, firstName: req.newStudent!.firstName.trim(), lastName: req.newStudent!.lastName.trim(),
        course: req.newStudent!.course?.trim() || null, passed: [],
      };

  // --- Parada que corresponde ---
  const passedIds = new Set(info.passed.map((p) => p.id));
  const highest = info.passed.reduce((max, p) => Math.max(max, p.position), 0);
  const nextStop = stops.find((s) => s.position > highest) ?? null;

  let target: StopInfo | null;
  if (req.stopId) {
    target = stops.find((s) => s.id === req.stopId) ?? null;
    if (!target) return { status: "error", message: "La parada elegida no existe o está desactivada." };
  } else {
    target = nextStop;
  }
  if (!target) return { status: "completed", scannedAt: scannedAtIso, student: info };

  if (passedIds.has(target.id)) {
    const prev = info.passed.find((p) => p.id === target.id)!;
    return { status: "duplicate", scannedAt: scannedAtIso, student: info, stop: target, previousAt: prev.scannedAt, previousBy: prev.scannedBy };
  }

  const skipped = stops.filter((s) => s.position < target.position && !passedIds.has(s.id));
  if (skipped.length > 0 && !req.force) {
    return { status: "skip_warning", scannedAt: scannedAtIso, student: found ? info : null, stop: target, skipped, nextStop };
  }

  // --- Inserción (si el alumno es nuevo, el alta y el registro van en una sola sentencia) ---
  let scanId: number | null = null;
  try {
    if (found) {
      const ins = await pool.query(
        `INSERT INTO scans (student_id, stop_id, scanned_by, scanned_at, method, skipped_previous)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [found.id, target.id, userId, scannedAt, req.method, skipped.length > 0],
      );
      scanId = Number(ins.rows[0].id);
    } else {
      const ins = await pool.query(
        `WITH s AS (
           INSERT INTO students (dni, first_name, last_name, course, created_by)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (dni) DO NOTHING RETURNING id)
         INSERT INTO scans (student_id, stop_id, scanned_by, scanned_at, method, skipped_previous)
         SELECT s.id, $6, $5, $7, $8, $9 FROM s RETURNING id, student_id`,
        [req.dni, info.firstName, info.lastName, info.course, userId, target.id, scannedAt, req.method, skipped.length > 0],
      );
      if (!ins.rows[0]) return { status: "error", message: "Otro administrador cargó a este alumno al mismo tiempo. Volvé a escanearlo." };
      scanId = Number(ins.rows[0].id);
      info.id = ins.rows[0].student_id;
    }
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { status: "error", message: "Este alumno ya fue cargado en esa parada (registro simultáneo)." };
    }
    throw err;
  }

  info.passed = [...info.passed, { ...target, scannedAt: scannedAtIso, scannedBy: ctx.user_name }].sort((a, b) => a.position - b.position);
  const newHighest = Math.max(highest, target.position);
  return {
    status: "ok",
    scanId,
    scannedAt: scannedAtIso,
    student: info,
    stop: target,
    skipped,
    nextStop: stops.find((s) => s.position > newHighest) ?? null,
    createdStudent: !found,
  };
}
