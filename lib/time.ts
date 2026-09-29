import { TIME_ZONE } from "./config";

type DateInput = Date | string | number;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, ...opts });

const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const dateFmt = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = fmt({
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** 14:05:32 en horario de Mendoza */
export const formatTime = (d: DateInput) => timeFmt.format(new Date(d));
/** 29/09/2026 */
export const formatDate = (d: DateInput) => dateFmt.format(new Date(d));
/** 29/09/2026 14:05:32 */
export const formatDateTime = (d: DateInput) => dateTimeFmt.format(new Date(d)).replace(",", "");

/** yyyy-mm-dd de "hoy" en Mendoza */
export function todayInMendoza(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Duración en segundos -> "1 h 05 min" / "12 min 03 s" / "45 s" */
export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")} s`;
  return `${sec} s`;
}
