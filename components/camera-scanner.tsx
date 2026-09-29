"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";

type Props = {
  /** Se llama con el texto de cada código leído (ya sin repetidos inmediatos). */
  onDetect: (text: string) => void;
  /** Mientras está en pausa se ignoran las lecturas (por ejemplo, mientras se resuelve una alerta). */
  paused?: boolean;
};

const NATIVE_FORMATS = ["code_128", "code_39", "code_93", "itf", "ean_13", "ean_8", "codabar", "pdf417", "qr_code", "upc_a", "upc_e"];
const REPEAT_MS = 3500;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CameraScanner({ onDetect, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const onDetectRef = useRef(onDetect);
  const pausedRef = useRef(paused);
  onDetectRef.current = onDetect;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = { text: "", at: 0 };

    const emit = (text: string) => {
      const now = Date.now();
      if (pausedRef.current || !text) return;
      if (text === last.text && now - last.at < REPEAT_MS) return;
      last = { text, at: now };
      onDetectRef.current(text);
    };

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("La cámara solo funciona con HTTPS (o en localhost).");
        }
        const video = videoRef.current!;
        const Detector = (window as any).BarcodeDetector;

        if (Detector) {
          // Detector nativo del navegador (Chrome/Android): más rápido y preciso.
          const supported: string[] = await Detector.getSupportedFormats();
          const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
          const detector = new Detector({ formats });
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          video.srcObject = stream;
          await video.play();
          const tick = async () => {
            if (cancelled) return;
            try {
              if (video.readyState >= 2) {
                const codes = await detector.detect(video);
                if (codes.length) emit(codes[0].rawValue);
              }
            } catch {
              /* frame inválido, se reintenta */
            }
            timer = setTimeout(tick, 120);
          };
          tick();
        } else {
          // Alternativa (Safari/iOS, Firefox): decodificador ZXing en JavaScript.
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const hints = new Map<any, any>();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF,
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODABAR, BarcodeFormat.PDF_417, BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
          const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
            if (result) emit(result.getText());
          });
          if (cancelled) controls.stop();
          else zxingControls = controls;
        }
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const e = err as { name?: string; message?: string };
        setErrorMsg(
          e.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Habilitalo en el navegador."
            : e.name === "NotFoundError"
              ? "No se encontró una cámara en este dispositivo."
              : e.message || "No se pudo iniciar la cámara.",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (status === "error") {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-navy-950 p-6 text-center text-brand-100">
        <CameraOff className="size-8 text-sun-400" />
        <p className="text-sm font-semibold">{errorMsg}</p>
        <p className="text-xs opacity-80">Podés seguir cargando con el lector o escribiendo el DNI.</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-navy-950">
      <video ref={videoRef} className="size-full object-cover" playsInline muted />
      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-brand-100">
          <Loader2 className="size-7 animate-spin" />
        </div>
      )}
      {status === "ready" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-2/5 w-4/5 rounded-xl border-2 border-sun-400/90 shadow-[0_0_0_999px_rgb(15_27_68/0.45)]">
            <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
        </div>
      )}
      {paused && status === "ready" && (
        <div className="absolute inset-x-0 bottom-0 bg-navy-950/80 py-1.5 text-center text-xs font-bold text-sun-300">
          En pausa · resolvé la alerta
        </div>
      )}
    </div>
  );
}
