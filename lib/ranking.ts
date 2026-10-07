import "server-only";
import { query, queryOne } from "./db";
import { TIME_ZONE } from "./config";
import { searchStudentIds } from "./student-search";

/** Valor del filtro de curso para los alumnos que no tienen curso asignado. */
export const NO_COURSE = "Sin curso";

export type RankingFilters = {
  /** Nombre del curso, o NO_COURSE. */
  course?: string;
  /** completed: llegaron a la etapa final · running: largaron y aún no llegan · all: ambos. */
  status?: "completed" | "running" | "all";
  /** yyyy-mm-dd (Mendoza): día en que llegaron a la etapa final. */
  date?: string;
  q?: string;
  /** slowest invierte el orden de los que completaron. */
  order?: "fastest" | "slowest";
};

export type RankingRow = {
  /** Puesto dentro del curso filtrado (o general); null si todavía no completó. */
  rank: number | null;
  studentId: number;
  name: string;
  dni: string;
  course: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
};

export type RankingSummary = {
  students: number;
  started: number;
  finished: number;
  fastest: number | null;
  avg: number | null;
  median: number | null;
  firstStartAt: string | null;
  lastStartAt: string | null;
  stages: { start: string; end: string } | null;
};

export type CourseRanking = {
  course: string;
  students: number;
  started: number;
  finished: number;
  fastest: number | null;
  avg: number | null;
  median: number | null;
};

const COURSE_EXPR = `coalesce(nullif(trim(s.course), ''), '${NO_COURSE}')`;

/**
 * Etapa inicial = primera parada activa; etapa final = última parada activa.
 * Una fila por alumno que largó (tiene registro en la etapa inicial); el tiempo es la
 * diferencia entre ambos registros.
 */
const RUNS = `
  stage AS (
    SELECT (SELECT id FROM stops WHERE active ORDER BY position LIMIT 1) AS first_id,
           (SELECT id FROM stops WHERE active ORDER BY position DESC LIMIT 1) AS last_id),
  runs AS (
    SELECT s.id AS student_id, s.first_name, s.last_name, s.dni, s.course, ${COURSE_EXPR} AS course_name,
           a.scanned_at AS started_at, b.scanned_at AS finished_at,
           CASE WHEN b.scanned_at IS NOT NULL
                THEN round(extract(epoch FROM b.scanned_at - a.scanned_at))::int END AS duration
      FROM students s
      JOIN stage ON stage.first_id IS NOT NULL
      JOIN scans a ON a.student_id = s.id AND a.stop_id = stage.first_id AND a.deleted_at IS NULL
      LEFT JOIN scans b ON b.student_id = s.id AND b.stop_id = stage.last_id AND b.deleted_at IS NULL
                       AND stage.last_id <> stage.first_id
     WHERE s.active)`;

function courseClause(course: string | undefined, params: unknown[], column: string) {
  if (!course) return "TRUE";
  params.push(course);
  return `${column} = $${params.length}`;
}

export async function getRanking(f: RankingFilters, limit: number, offset: number): Promise<{ rows: RankingRow[]; total: number }> {
  const params: unknown[] = [];
  const course = courseClause(f.course, params, "course_name");

  const outer: string[] = [];
  const status = f.status ?? "completed";
  if (status === "completed") outer.push("finished_at IS NOT NULL");
  if (status === "running") outer.push("finished_at IS NULL");
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
    params.push(f.date);
    outer.push(`(finished_at AT TIME ZONE '${TIME_ZONE}')::date = $${params.length}::date`);
  }
  if (f.q?.trim()) {
    params.push(await searchStudentIds(f.q));
    outer.push(`student_id = ANY($${params.length}::int[])`);
  }

  const dir = f.order === "slowest" ? "DESC" : "ASC";
  const orderBy =
    status === "running"
      ? "started_at ASC, last_name, first_name"
      : `duration ${dir} NULLS LAST, finished_at ${dir}, last_name, first_name`;

  const sql = `
    WITH ${RUNS},
    ranked AS (
      SELECT runs.*, CASE WHEN duration IS NOT NULL THEN rank() OVER (ORDER BY duration) END AS rank
        FROM runs WHERE ${course})
    SELECT *, count(*) OVER ()::int AS total FROM ranked
     WHERE ${outer.length ? outer.join(" AND ") : "TRUE"}
     ORDER BY ${orderBy}
     LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;

  const rows = await query(sql, params);
  const data: RankingRow[] = rows.map((r) => ({
    rank: r.rank == null ? null : Number(r.rank),
    studentId: r.student_id,
    name: `${r.last_name}, ${r.first_name}`,
    dni: r.dni,
    course: r.course_name === NO_COURSE ? null : r.course_name,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    durationSeconds: r.duration,
  }));

  if (rows.length > 0) return { rows: data, total: rows[0].total as number };
  // Página fuera de rango: el total hay que pedirlo aparte.
  if (offset === 0) return { rows: data, total: 0 };
  const { total } = await getRanking(f, 1, 0);
  return { rows: data, total };
}

/** Resumen del alcance elegido (curso o todos): cuántos largaron, completaron y los tiempos. */
export async function getRankingSummary(course?: string): Promise<RankingSummary> {
  const params: unknown[] = [];
  const studentsCourse = courseClause(course, params, COURSE_EXPR);
  const runsCourse = course ? studentsCourse.replace(COURSE_EXPR, "course_name") : "TRUE";
  const [row, stages] = await Promise.all([
    queryOne(
      `WITH ${RUNS}
       SELECT (SELECT count(*) FROM students s WHERE s.active AND ${studentsCourse})::int AS students,
              count(*)::int AS started,
              count(finished_at)::int AS finished,
              min(duration) AS fastest, avg(duration) AS avg,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY duration) AS median,
              min(started_at) AS first_start, max(started_at) AS last_start
         FROM runs WHERE ${runsCourse}`,
      params,
    ),
    queryOne<{ first_name: string | null; last_name: string | null; same: boolean }>(
      `SELECT (SELECT name FROM stops WHERE active ORDER BY position LIMIT 1) AS first_name,
              (SELECT name FROM stops WHERE active ORDER BY position DESC LIMIT 1) AS last_name,
              (SELECT count(*) FROM stops WHERE active) < 2 AS same`,
    ),
  ]);
  const r = row!;
  return {
    students: r.students,
    started: r.started,
    finished: r.finished,
    fastest: r.fastest,
    avg: r.avg == null ? null : Number(r.avg),
    median: r.median == null ? null : Number(r.median),
    firstStartAt: r.first_start ? r.first_start.toISOString() : null,
    lastStartAt: r.last_start ? r.last_start.toISOString() : null,
    stages: stages?.first_name && stages.last_name && !stages.same ? { start: stages.first_name, end: stages.last_name } : null,
  };
}

/** Comparativa de tiempos por curso. */
export async function getCourseRanking(): Promise<CourseRanking[]> {
  const rows = await query(`
    WITH ${RUNS}
    SELECT ${COURSE_EXPR} AS course,
           count(*)::int AS students,
           count(r.student_id)::int AS started,
           count(r.finished_at)::int AS finished,
           min(r.duration) AS fastest, avg(r.duration) AS avg,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY r.duration) AS median
      FROM students s
      LEFT JOIN runs r ON r.student_id = s.id
     WHERE s.active
     GROUP BY 1
     ORDER BY avg(r.duration) ASC NULLS LAST, 1`);
  return rows.map((r) => ({
    course: r.course,
    students: r.students,
    started: r.started,
    finished: r.finished,
    fastest: r.fastest,
    avg: r.avg == null ? null : Number(r.avg),
    median: r.median == null ? null : Number(r.median),
  }));
}

/** Cursos para el selector de filtro (con alumnos activos). */
export async function getRankingCourses(): Promise<string[]> {
  const rows = await query<{ course: string }>(
    `SELECT DISTINCT ${COURSE_EXPR} AS course FROM students s WHERE s.active ORDER BY 1`,
  );
  return rows.map((r) => r.course);
}
