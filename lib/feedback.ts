"use client";

let ctx: AudioContext | null = null;

function beep(freq: number, ms: number, when = 0, volume = 0.15) {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + when;
    osc.start(start);
    gain.gain.setTargetAtTime(0, start + ms / 1000 - 0.03, 0.015);
    osc.stop(start + ms / 1000);
  } catch {
    /* sin audio disponible */
  }
}

export type Tone = "ok" | "warn" | "error";

export function feedback(tone: Tone, soundOn: boolean) {
  if (soundOn) {
    if (tone === "ok") { beep(880, 90); beep(1320, 120, 0.1); }
    else if (tone === "warn") { beep(660, 140); beep(660, 140, 0.2); }
    else { beep(220, 320, 0, 0.2); }
  }
  try {
    navigator.vibrate?.(tone === "ok" ? 60 : tone === "warn" ? [80, 60, 80] : 250);
  } catch {
    /* ignore */
  }
}
