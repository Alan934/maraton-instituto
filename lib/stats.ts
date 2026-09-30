import "server-only";
import { query, queryOne } from "./db";
import { TIME_ZONE } from "./config";
import { todayInMendoza } from "./time";

// Registros válidos: no anulados y de paradas activas.
const VALID_SCANS = `
  SELECT sc.id, sc.student_id, sc.stop_id, sc.scanned_by, sc.scanned_at, sc.method, sc.skipped_previous, p.position
    FROM scans sc
    JOIN stops p ON p.id = sc.stop_id AND p.active
   WHERE sc.deleted_at IS NULL`;

export type Overview = {
  totalStudents: number;
  started: number;
  finished: number;
  notStarted: number;
  totalScans: number;
  skippedScans: number;
  lastScanAt: string | null;
  stopCount: number;
  inProgress: number;
  scansLast15: number;
  scansLastHour: number;
  methods: { scanner: number; camera: number; manual: number };
  finishTimes: { avg: number; median: number; fastest: number; slowest: number } | null;
};

export type StopStat = {
  id: number;
  position: number;
  name: string;
  passed: number;
  current: number;
  avgFromPrevSeconds: number | null;
  firstAt: string | null;
  lastAt: string | null;
};

export type HourBucket = { hour: number; count: number };
export type CourseStat = { course: string; total: number; started: number; finished: number; avgStops: number };
export type FinisherStat = {
  rank: number;
  studentId: number;
  name: string;
  course: string | null;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
};
export type AdminStat = { id: number; name: string; role: string; scans: number; firstAt: string | null; lastAt: string | null };
export type RecentScan = {
  id: number;
  scannedAt: string;
  studentName: string;
  dni: string;
  course: string | null;
  stopName: string;
  stopPosition: number;
  adminName: string | null;
  method: string;
  skippedPrevious: boolean;
};

export type Stats = {
  overview: Overview;
  stops: StopStat[];
  timeline: { date: string; availableDates: string[]; buckets: HourBucket[] };
  courses: CourseStat[];
  finishers: FinisherStat[];
  admins: AdminStat[];
  recent: RecentScan[];
  generatedAt: string;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function getStats(dateParam?: string | null): Promise<Stats> {
  const [overviewRow, stopRows, dateRows, courseRows, finisherRows, adminRows, recentRows] = await Promise.all([
    queryOne(`
      WITH vs AS (${VALID_SCANS}),
      last_stop AS (SELECT id FROM stops WHERE active ORDER BY position DESC LIMIT 1),
      fin AS (
        SELECT extract(epoch FROM f.scanned_at - b.t)::float AS d
          FROM vs f JOIN (SELECT student_id, min(scanned_at) AS t FROM vs GROUP BY student_id) b ON b.student_id = f.student_id
         WHERE f.stop_id = (SELECT id FROM last_stop))
      SELECT
        (SELECT count(*) FROM students WHERE active)::int AS total_students,
        (SELECT count(DISTINCT student_id) FROM vs)::int AS started,
        (SELECT count(DISTINCT student_id) FROM vs WHERE stop_id = (SELECT id FROM last_stop))::int AS finished,
        (SELECT count(*) FROM vs)::int AS total_scans,
        (SELECT count(*) FROM vs WHERE skipped_previous)::int AS skipped_scans,
        (SELECT max(scanned_at) FROM vs) AS last_scan_at,
        (SELECT count(*) FROM stops WHERE active)::int AS stop_count,
        (SELECT count(*) FROM vs WHERE scanned_at > now() - interval '15 minutes')::int AS scans_15,
        (SELECT count(*) FROM vs WHERE scanned_at > now() - interval '60 minutes')::int AS scans_60,
        (SELECT count(*) FROM vs WHERE method = 'scanner')::int AS m_scanner,
        (SELECT count(*) FROM vs WHERE method = 'camera')::int AS m_camera,
        (SELECT count(*) FROM vs WHERE method = 'manual')::int AS m_manual,
        (SELECT avg(d) FROM fin) AS fin_avg,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY d) FROM fin) AS fin_median,
        (SELECT min(d) FROM fin) AS fin_min,
        (SELECT max(d) FROM fin) AS fin_max`),
    query(`
      WITH vs AS (${VALID_SCANS}),
      seq AS (
        SELECT student_id, stop_id, position, scanned_at,
               lag(scanned_at) OVER (PARTITION BY student_id ORDER BY position) AS prev_at
          FROM vs),
      highest AS (SELECT student_id, max(position) AS pos FROM vs GROUP BY student_id)
      SELECT p.id, p.position, p.name,
             count(seq.student_id)::int AS passed,
             (SELECT count(*) FROM highest h WHERE h.pos = p.position)::int AS current,
             avg(extract(epoch FROM seq.scanned_at - seq.prev_at))
               FILTER (WHERE seq.prev_at IS NOT NULL AND seq.scanned_at > seq.prev_at) AS avg_from_prev,
             min(seq.scanned_at) AS first_at, max(seq.scanned_at) AS last_at
        FROM stops p
        LEFT JOIN seq ON seq.stop_id = p.id
       WHERE p.active
       GROUP BY p.id ORDER BY p.position`),
    query(
      `WITH vs AS (${VALID_SCANS})
       SELECT to_char(d, 'YYYY-MM-DD') AS d
         FROM (SELECT DISTINCT (scanned_at AT TIME ZONE '${TIME_ZONE}')::date AS d FROM vs) x
        ORDER BY d DESC LIMIT 60`,
    ),
    query(`
      WITH vs AS (${VALID_SCANS}),
      last_stop AS (SELECT id FROM stops WHERE active ORDER BY position DESC LIMIT 1)
      SELECT coalesce(nullif(trim(s.course), ''), 'Sin curso') AS course,
             count(*)::int AS total,
             count(*) FILTER (WHERE pr.n > 0)::int AS started,
             count(*) FILTER (WHERE pr.finished)::int AS finished,
             coalesce(avg(pr.n), 0)::float AS avg_stops
        FROM students s
        LEFT JOIN LATERAL (
          SELECT count(*) AS n, coalesce(bool_or(stop_id = (SELECT id FROM last_stop)), false) AS finished
            FROM vs WHERE vs.student_id = s.id) pr ON true
       WHERE s.active
       GROUP BY 1 ORDER BY 1`),
    query(`
      WITH vs AS (${VALID_SCANS}),
      last_stop AS (SELECT id FROM stops WHERE active ORDER BY position DESC LIMIT 1),
      bounds AS (SELECT student_id, min(scanned_at) AS started_at FROM vs GROUP BY student_id)
      SELECT s.id, s.first_name, s.last_name, s.course, b.started_at, f.scanned_at AS finished_at,
             extract(epoch FROM f.scanned_at - b.started_at)::float AS duration
        FROM vs f
        JOIN bounds b ON b.student_id = f.student_id
        JOIN students s ON s.id = f.student_id
       WHERE f.stop_id = (SELECT id FROM last_stop)
       ORDER BY duration ASC, f.scanned_at ASC
       LIMIT 10`),
    query(`
      WITH vs AS (${VALID_SCANS})
      SELECT u.id, u.full_name, u.role, count(vs.id)::int AS scans, min(vs.scanned_at) AS first_at, max(vs.scanned_at) AS last_at
        FROM users u LEFT JOIN vs ON vs.scanned_by = u.id
       WHERE u.active
       GROUP BY u.id ORDER BY scans DESC, u.full_name`),
    query(`
      WITH vs AS (${VALID_SCANS})
      SELECT vs.id, vs.scanned_at, s.first_name, s.last_name, s.dni, s.course, p.name AS stop_name, p.position,
             u.full_name AS admin_name, vs.method, vs.skipped_previous
        FROM vs
        JOIN students s ON s.id = vs.student_id
        JOIN stops p ON p.id = vs.stop_id
        LEFT JOIN users u ON u.id = vs.scanned_by
       ORDER BY vs.scanned_at DESC LIMIT 12`),
  ]);

  const availableDates: string[] = dateRows.map((r) => r.d);
  const today = todayInMendoza();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : availableDates.includes(today) || availableDates.length === 0
        ? today
        : availableDates[0];

  const hourRows = await query(
    `WITH vs AS (${VALID_SCANS})
     SELECT extract(hour FROM scanned_at AT TIME ZONE '${TIME_ZONE}')::int AS hour, count(*)::int AS count
       FROM vs
      WHERE (scanned_at AT TIME ZONE '${TIME_ZONE}')::date = $1::date
      GROUP BY 1 ORDER BY 1`,
    [date],
  );
  const byHour = new Map<number, number>(hourRows.map((r) => [r.hour, r.count]));
  let buckets: HourBucket[] = [];
  if (byHour.size > 0) {
    const hours = [...byHour.keys()];
    const from = Math.min(...hours);
    const to = Math.max(...hours);
    for (let h = from; h <= to; h++) buckets.push({ hour: h, count: byHour.get(h) ?? 0 });
  }

  const o = overviewRow!;
  return {
    overview: {
      totalStudents: o.total_students,
      started: o.started,
      finished: o.finished,
      notStarted: Math.max(0, o.total_students - o.started),
      totalScans: o.total_scans,
      skippedScans: o.skipped_scans,
      lastScanAt: iso(o.last_scan_at),
      stopCount: o.stop_count,
      inProgress: Math.max(0, o.started - o.finished),
      scansLast15: o.scans_15,
      scansLastHour: o.scans_60,
      methods: { scanner: o.m_scanner, camera: o.m_camera, manual: o.m_manual },
      finishTimes:
        o.fin_avg == null
          ? null
          : { avg: Number(o.fin_avg), median: Number(o.fin_median), fastest: Number(o.fin_min), slowest: Number(o.fin_max) },
    },
    stops: stopRows.map((r) => ({
      id: r.id,
      position: r.position,
      name: r.name,
      passed: r.passed,
      current: r.current,
      avgFromPrevSeconds: r.avg_from_prev == null ? null : Number(r.avg_from_prev),
      firstAt: iso(r.first_at),
      lastAt: iso(r.last_at),
    })),
    timeline: { date, availableDates, buckets },
    courses: courseRows.map((r) => ({ course: r.course, total: r.total, started: r.started, finished: r.finished, avgStops: r.avg_stops })),
    finishers: finisherRows.map((r, i) => ({
      rank: i + 1,
      studentId: r.id,
      name: `${r.last_name}, ${r.first_name}`,
      course: r.course,
      startedAt: r.started_at.toISOString(),
      finishedAt: r.finished_at.toISOString(),
      durationSeconds: r.duration,
    })),
    admins: adminRows.map((r) => ({ id: r.id, name: r.full_name, role: r.role, scans: r.scans, firstAt: iso(r.first_at), lastAt: iso(r.last_at) })),
    recent: recentRows.map((r) => ({
      id: Number(r.id),
      scannedAt: r.scanned_at.toISOString(),
      studentName: `${r.last_name}, ${r.first_name}`,
      dni: r.dni,
      course: r.course,
      stopName: r.stop_name,
      stopPosition: r.position,
      adminName: r.admin_name,
      method: r.method,
      skippedPrevious: r.skipped_previous,
    })),
    generatedAt: new Date().toISOString(),
  };
}
