"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Camera, CameraOff, CheckCircle2, Clock, Flag, Keyboard, Loader2, Undo2, UserPlus, Volume2, VolumeX, XCircle,
} from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";
import { feedback } from "@/lib/feedback";
import { formatDni, parseDni } from "@/lib/dni";
import { formatTime } from "@/lib/time";
import type { ScanMethod, ScanResult, StopInfo } from "@/lib/scan";

type Props = { stops: StopInfo[]; courses: string[] };

type NewStudent = { firstName: string; lastName: string; course: string | null };
type Pending = { dni: string; method: ScanMethod; scannedAt: string; stopId: number | null; newStudent?: NewStudent };
type Card =
  | { kind: "idle" }
  | { kind: "loading"; dni: string }
  | { kind: "result"; result: ScanResult; pending: Pending; undone?: boolean };

type LogEntry = { id: number; name: string; dni: string; stopLabel: string; at: string; skipped: boolean; undone: boolean };

const AUTO = "auto";
const stopLabel = (s: StopInfo) => `Parada ${s.position} · ${s.name}`;
const fullName = (s: { firstName: string; lastName: string }) => `${s.lastName}, ${s.firstName}`;

function readPref(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function Scanner({ stops, courses }: Props) {
  const [stopMode, setStopMode] = useState<string>(AUTO);
  const [sound, setSound] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState("");
  const [card, setCard] = useState<Card>({ kind: "idle" });
  const [log, setLog] = useState<LogEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const cardRef = useRef<Card>(card);
  cardRef.current = card;
  const stopModeRef = useRef(stopMode);
  stopModeRef.current = stopMode;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Preferencias guardadas en este dispositivo
  useEffect(() => {
    const saved = readPref("scan.stopMode", AUTO);
    if (saved === AUTO || stops.some((s) => String(s.id) === saved)) setStopMode(saved);
    setSound(readPref("scan.sound", "1") === "1");
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [stops]);

  const needsAction = (c: Card) =>
    c.kind === "result" && (c.result.status === "skip_warning" || c.result.status === "unknown_student");

  const send = useCallback(
    async (payload: {
      dni: string; method: ScanMethod; stopId: number | null; force?: boolean; scannedAt?: string; newStudent?: NewStudent;
    }) => {
      busyRef.current = true;
      setCard({ kind: "loading", dni: payload.dni });
      let result: ScanResult;
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        result = (await res.json()) as ScanResult;
      } catch {
        result = { status: "error", message: "Sin conexión con el servidor. Verificá internet y volvé a escanear." };
      } finally {
        busyRef.current = false;
      }

      const pending: Pending = {
        dni: payload.dni,
        method: payload.method,
        stopId: payload.stopId,
        newStudent: payload.newStudent,
        scannedAt: "scannedAt" in result ? result.scannedAt : payload.scannedAt ?? new Date().toISOString(),
      };
      setCard({ kind: "result", result, pending });

      if (result.status === "ok") {
        feedback("ok", soundRef.current);
        setLog((l) =>
          [{
            id: result.scanId, name: fullName(result.student), dni: result.student.dni, stopLabel: stopLabel(result.stop),
            at: result.scannedAt, skipped: result.skipped.length > 0, undone: false,
          }, ...l].slice(0, 12),
        );
      } else if (result.status === "skip_warning" || result.status === "unknown_student") {
        feedback("warn", soundRef.current);
      } else {
        feedback("error", soundRef.current);
      }
    },
    [],
  );

  /** Punto de entrada común para lector, cámara y carga manual. */
  const submitCode = useCallback(
    (raw: string, method: ScanMethod) => {
      if (busyRef.current) return;
      const dni = parseDni(raw);
      if (!dni) {
        feedback("error", soundRef.current);
        setCard({
          kind: "result",
          result: { status: "error", message: `No se pudo leer un DNI válido${raw.trim() ? ` en "${raw.trim().slice(0, 24)}"` : ""}. Probá de nuevo o escribilo a mano.` },
          pending: { dni: raw, method, scannedAt: new Date().toISOString(), stopId: null },
        });
        return;
      }
      if (needsAction(cardRef.current)) {
        // No se pierde ninguna alerta en silencio: primero hay que resolver la actual.
        feedback("error", soundRef.current);
        return;
      }
      const mode = stopModeRef.current;
      void send({ dni, method, stopId: mode === AUTO ? null : Number(mode) });
    },
    [send],
  );

  // El lector de códigos "tipea" como un teclado: si el foco está en otro lado, se lo redirige al campo de DNI.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const el = document.activeElement as HTMLElement | null;
      const editable = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (!editable) inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = manual;
    if (!value.trim()) return;
    setManual("");
    submitCode(value, typedByHand.current ? "manual" : "scanner");
    typedByHand.current = true;
  };

  // Distingue el lector (ráfaga de teclas con menos de 50 ms entre sí) del tipeo a mano.
  const typedByHand = useRef(true);
  const lastKeyAt = useRef(0);
  const burst = useRef(0);
  const onManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length !== 1) return;
    const now = performance.now();
    burst.current = now - lastKeyAt.current < 50 ? burst.current + 1 : 0;
    lastKeyAt.current = now;
    typedByHand.current = burst.current < 4;
  };

  const changeStopMode = (value: string) => {
    setStopMode(value);
    writePref("scan.stopMode", value);
    inputRef.current?.focus();
  };

  const toggleSound = () => {
    setSound((s) => {
      writePref("scan.sound", s ? "0" : "1");
      return !s;
    });
  };

  const undo = async (scanId: number) => {
    const res = await fetch("/api/scan/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scanId }),
    }).then((r) => r.json()).catch(() => ({ ok: false, message: "Sin conexión." }));
    if (res.ok) {
      setLog((l) => l.map((e) => (e.id === scanId ? { ...e, undone: true } : e)));
      setCard((c) => (c.kind === "result" ? { ...c, undone: true } : c));
      feedback("warn", soundRef.current);
    } else {
      alert(res.message ?? "No se pudo anular.");
    }
  };

  const dismiss = () => {
    setCard({ kind: "idle" });
    inputRef.current?.focus();
  };

  const paused = needsAction(card) || card.kind === "loading";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {/* Resultado */}
        <ResultCard
          card={card}
          stops={stops}
          courses={courses}
          onDismiss={dismiss}
          onUndo={undo}
          onConfirm={(pending, extra) => void send({ ...pending, ...extra })}
        />

        {/* Entrada */}
        <section className="card card-pad space-y-4">
          <div>
            <label htmlFor="stop-mode" className="label flex items-center gap-1.5">
              <Flag className="size-3.5" /> Parada a registrar
            </label>
            <select id="stop-mode" className="input font-semibold" value={stopMode} onChange={(e) => changeStopMode(e.target.value)}>
              <option value={AUTO}>Automática · la siguiente que le corresponde a cada alumno</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>{stopLabel(s)}</option>
              ))}
            </select>
            {stopMode !== AUTO && (
              <p className="mt-1.5 text-xs font-semibold text-amber-700">
                Estás forzando una parada: todos los escaneos irán a esa parada. Si se saltean anteriores, se te va a avisar.
              </p>
            )}
          </div>

          <form onSubmit={onManualSubmit}>
            <label htmlFor="dni" className="label flex items-center gap-1.5">
              <Keyboard className="size-3.5" /> Escanear con el lector o escribir el DNI
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="dni"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={onManualKeyDown}
                className="input num text-lg font-bold tracking-wide"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ej: 45123456"
                aria-describedby="dni-help"
              />
              <button type="submit" className="btn btn-primary" disabled={!manual.trim() || paused}>
                Cargar
              </button>
            </div>
            <p id="dni-help" className="mt-1.5 text-xs text-[color:var(--muted)]">
              El lector carga solo al terminar de leer. Si escribís a mano, apretá Enter o “Cargar”.
            </p>
          </form>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn btn-sm ${cameraOn ? "btn-sun" : "btn-ghost"}`} onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
              {cameraOn ? "Apagar cámara" : "Escanear con la cámara"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSound} aria-pressed={sound}>
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              Sonido {sound ? "activado" : "silenciado"}
            </button>
          </div>

          {cameraOn && (
            <div className="mx-auto max-w-md">
              <CameraScanner paused={paused} onDetect={(text) => submitCode(text, "camera")} />
            </div>
          )}
        </section>
      </div>

      {/* Historial del dispositivo */}
      <aside className="card card-pad h-fit">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
          <Clock className="size-4" /> Cargados en este dispositivo
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Todavía no cargaste a nadie en esta sesión.</p>
        ) : (
          <ul className="divide-y divide-brand-100">
            {log.map((e) => (
              <li key={e.id} className={`py-2.5 ${e.undone ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${e.undone ? "line-through" : ""}`}>{e.name}</p>
                  <span className="num shrink-0 text-xs font-semibold text-[color:var(--muted)]">{formatTime(e.at)}</span>
                </div>
                <p className="text-xs text-[color:var(--muted)]">
                  DNI {formatDni(e.dni)} · {e.stopLabel}
                  {e.skipped && <span className="badge badge-sun ml-1.5">salteó</span>}
                  {e.undone && <span className="badge badge-bad ml-1.5">anulado</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResultCard({
  card, stops, courses, onDismiss, onUndo, onConfirm,
}: {
  card: Card;
  stops: StopInfo[];
  courses: string[];
  onDismiss: () => void;
  onUndo: (scanId: number) => void;
  onConfirm: (pending: Pending, extra: { force?: boolean; stopId?: number | null; newStudent?: NewStudent }) => void;
}) {
  if (card.kind === "idle") {
    return (
      <div className="card grid place-items-center gap-2 border-dashed p-10 text-center text-[color:var(--muted)]">
        <Flag className="size-9 text-brand-400" />
        <p className="font-bold">Esperando al próximo alumno…</p>
        <p className="text-sm">Escaneá el código de barras del DNI.</p>
      </div>
    );
  }
  if (card.kind === "loading") {
    return (
      <div className="card flex items-center justify-center gap-3 p-10 font-bold">
        <Loader2 className="size-6 animate-spin text-brand-600" /> Registrando DNI {formatDni(card.dni)}…
      </div>
    );
  }

  const { result, pending } = card;

  if (result.status === "ok") {
    const s = result.student;
    return (
      <div className={`card pop overflow-hidden ${card.undone ? "opacity-60" : ""}`}>
        <div className={`flex items-center gap-3 px-5 py-3 text-white ${card.undone ? "bg-slate-500" : "bg-emerald-600"}`}>
          <CheckCircle2 className="size-7 shrink-0" />
          <p className="text-lg font-extrabold">{card.undone ? "Registro anulado" : "Registrado"}</p>
          {result.createdStudent && <span className="badge ml-auto bg-white/20 text-white">alumno nuevo</span>}
        </div>
        <div className="space-y-3 p-5">
          <div>
            <p className="text-2xl font-extrabold leading-tight">{fullName(s)}</p>
            <p className="text-sm text-[color:var(--muted)]">
              DNI {formatDni(s.dni)}{s.course ? ` · ${s.course}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-sun-300 px-3 py-1.5 text-lg font-extrabold text-navy-950">{stopLabel(result.stop)}</span>
            <span className="num rounded-xl bg-brand-100 px-3 py-1.5 text-lg font-extrabold text-brand-700">{formatTime(result.scannedAt)}</span>
          </div>
          {result.skipped.length > 0 && (
            <p className="rounded-lg bg-sun-100 px-3 py-2 text-sm font-semibold text-amber-800">
              Se salteó: {result.skipped.map((p) => `Parada ${p.position}`).join(", ")}
            </p>
          )}
          <p className="text-sm text-[color:var(--muted)]">
            {result.nextStop ? <>Próxima parada: <b>{stopLabel(result.nextStop)}</b></> : <b className="text-emerald-700">Completó todas las paradas 🎉</b>}
          </p>
          {!card.undone && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUndo(result.scanId)}>
              <Undo2 className="size-4" /> Anular este registro
            </button>
          )}
        </div>
      </div>
    );
  }

  if (result.status === "skip_warning") {
    const name = result.student ? fullName(result.student) : `DNI ${formatDni(pending.dni)}`;
    return (
      <div className="card pop overflow-hidden ring-2 ring-sun-500">
        <div className="flex items-center gap-3 bg-sun-400 px-5 py-3 text-navy-950">
          <AlertTriangle className="size-7 shrink-0" />
          <p className="text-lg font-extrabold">Se estaría salteando una parada</p>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-xl font-extrabold">{name}</p>
          <p className="text-sm">
            Vas a cargarlo en <b>{stopLabel(result.stop)}</b>, pero no pasó por:
          </p>
          <ul className="space-y-1">
            {result.skipped.map((p) => (
              <li key={p.id} className="rounded-lg bg-sun-100 px-3 py-1.5 text-sm font-bold text-amber-900">{stopLabel(p)}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {result.nextStop && result.nextStop.id !== result.stop.id && (
              <button
                type="button" className="btn btn-primary"
                onClick={() => onConfirm(pending, { stopId: result.nextStop!.id })}
              >
                Cargar en {stopLabel(result.nextStop)}
              </button>
            )}
            <button type="button" className="btn btn-sun" onClick={() => onConfirm(pending, { force: true, stopId: result.stop.id })}>
              Cargar igual en Parada {result.stop.position}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === "unknown_student") {
    return <NewStudentForm dni={result.dni} courses={courses} onCancel={onDismiss} onSubmit={(newStudent) => onConfirm(pending, { newStudent })} />;
  }

  if (result.status === "duplicate") {
    return (
      <Alert tone="bad" title="Ya estaba registrado en esa parada" onDismiss={onDismiss}>
        <p className="text-xl font-extrabold">{fullName(result.student)}</p>
        <p className="text-sm">
          Pasó por <b>{stopLabel(result.stop)}</b> a las <b className="num">{formatTime(result.previousAt)}</b>
          {result.previousBy ? <> (cargó {result.previousBy})</> : null}.
        </p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Si querés registrarlo en otra parada, elegila arriba en “Parada a registrar”.
        </p>
      </Alert>
    );
  }

  if (result.status === "completed") {
    const last = result.student.passed.at(-1);
    return (
      <Alert tone="ok" title="Ya completó todas las paradas" onDismiss={onDismiss}>
        <p className="text-xl font-extrabold">{fullName(result.student)}</p>
        {last && <p className="text-sm">Último registro: {stopLabel(last)} a las <b className="num">{formatTime(last.scannedAt)}</b>.</p>}
      </Alert>
    );
  }

  if (result.status === "no_stops") {
    return (
      <Alert tone="bad" title="No hay paradas configuradas" onDismiss={onDismiss}>
        <p className="text-sm">Pedile al superadministrador que cargue las paradas antes de empezar.</p>
      </Alert>
    );
  }

  return (
    <Alert tone="bad" title="No se pudo registrar" onDismiss={onDismiss}>
      <p className="text-sm font-semibold">{result.message}</p>
    </Alert>
  );
}

function Alert({ tone, title, children, onDismiss }: { tone: "bad" | "ok"; title: string; children: React.ReactNode; onDismiss: () => void }) {
  const head = tone === "bad" ? "bg-red-600" : "bg-brand-600";
  return (
    <div className="card pop overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-3 text-white ${head}`}>
        {tone === "bad" ? <XCircle className="size-7 shrink-0" /> : <CheckCircle2 className="size-7 shrink-0" />}
        <p className="text-lg font-extrabold">{title}</p>
      </div>
      <div className="space-y-1 p-5">
        {children}
        <div className="pt-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function NewStudentForm({
  dni, courses, onSubmit, onCancel,
}: {
  dni: string;
  courses: string[];
  onSubmit: (s: NewStudent) => void;
  onCancel: () => void;
}) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [course, setCourse] = useState("");
  return (
    <form
      className="card pop overflow-hidden ring-2 ring-brand-400"
      onSubmit={(e) => {
        e.preventDefault();
        if (lastName.trim() && firstName.trim()) onSubmit({ firstName, lastName, course: course.trim() || null });
      }}
    >
      <div className="flex items-center gap-3 bg-brand-600 px-5 py-3 text-white">
        <UserPlus className="size-7 shrink-0" />
        <div>
          <p className="text-lg font-extrabold">Alumno no registrado</p>
          <p className="num text-sm opacity-90">DNI {formatDni(dni)}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-[color:var(--muted)]">Cargá sus datos para darlo de alta y registrar la parada en un solo paso.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ns-last" className="label">Apellido</label>
            <input id="ns-last" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus required maxLength={80} />
          </div>
          <div>
            <label htmlFor="ns-first" className="label">Nombre</label>
            <input id="ns-first" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
          </div>
        </div>
        <div>
          <label htmlFor="ns-course" className="label">Curso (opcional)</label>
          <select id="ns-course" className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Sin curso</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className="btn btn-primary"><UserPlus className="size-4" /> Dar de alta y registrar</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </form>
  );
}
