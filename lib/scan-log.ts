import "server-only";
import { query } from "./db";
import { TIME_ZONE } from "./config";

export type LogFilters = {
  q?: string;
  stopId?: number;
  adminId?: number;
  date?: string; // yyyy-mm-dd (Mendoza)
  voided?: boolean;
  /** Si se indica, solo devuelve los registros cargados por ese usuario. */
  onlyUserId?: number;
};

export type LogRow = {
  id: number;
  scannedAt: string;
  studentId: number;
  studentName: string;
  dni: string;
  course: string | null;
  stopPosition: number;
  stopName: string;
  adminName: string | null;
  method: "scanner" | "camera" | "manual";
  skippedPrevious: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
};

export function buildWhere(f: LogFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  where.push(f.voided ? "TRUE" : "sc.deleted_at IS NULL");
  if (f.onlyUserId) add("sc.scanned_by = ?", f.onlyUserId);
  if (f.adminId) add("sc.scanned_by = ?", f.adminId);
  if (f.stopId) add("sc.stop_id = ?", f.stopId);
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) add(`(sc.scanned_at AT TIME ZONE '${TIME_ZONE}')::date = ?::date`, f.date);
  if (f.q?.trim()) {
    const q = f.q.trim();
    const digits = q.replace(/\D/g, "");
    params.push(`%${q}%`);
    const nameParam = `$${params.length}`;
    let cond = `(s.last_name || ' ' || s.first_name ILIKE ${nameParam} OR s.first_name || ' ' || s.last_name ILIKE ${nameParam}`;
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      cond += ` OR s.dni LIKE $${params.length}`;
    }
    where.push(cond + ")");
  }
  return { sql: where.join(" AND "), params };
}

const FROM = `
  FROM scans sc
  JOIN students s ON s.id = sc.student_id
  JOIN stops p ON p.id = sc.stop_id
  LEFT JOIN users u ON u.id = sc.scanned_by
  LEFT JOIN users du ON du.id = sc.deleted_by`;

export async function getScanLog(f: LogFilters, limit: number, offset: number) {
  const { sql, params } = buildWhere(f);
  const [rows, count] = await Promise.all([
    query(
      `SELECT sc.id, sc.scanned_at, s.id AS student_id, s.first_name, s.last_name, s.dni, s.course,
              p.position, p.name AS stop_name, u.full_name AS admin_name, sc.method, sc.skipped_previous,
              sc.deleted_at, du.full_name AS deleted_by
         ${FROM} WHERE ${sql}
        ORDER BY sc.scanned_at DESC, sc.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    query(`SELECT count(*)::int AS n ${FROM} WHERE ${sql}`, params),
  ]);
  const data: LogRow[] = rows.map((r) => ({
    id: Number(r.id),
    scannedAt: r.scanned_at.toISOString(),
    studentId: r.student_id,
    studentName: `${r.last_name}, ${r.first_name}`,
    dni: r.dni,
    course: r.course,
    stopPosition: r.position,
    stopName: r.stop_name,
    adminName: r.admin_name,
    method: r.method,
    skippedPrevious: r.skipped_previous,
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    deletedBy: r.deleted_by,
  }));
  return { rows: data, total: count[0].n as number };
}
