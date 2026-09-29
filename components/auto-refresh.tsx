"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Vuelve a pedir los datos del servidor cada N segundos mientras la pestaña está visible. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setSpinning(true);
      router.refresh();
      setTimeout(() => setSpinning(false), 800);
    };
    const id = setInterval(tick, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted)]">
      <RefreshCw className={`size-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden />
      Se actualiza cada {seconds} s
    </span>
  );
}
