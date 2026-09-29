import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getScanLog } from "@/lib/scan-log";
import { formatDate, formatTime } from "@/lib/time";

// Se antepone un apóstrofo a valores que Excel podría interpretar como fórmula.
const csv = (v: unknown) => {
  const text = String(v ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Exporta los registros (con los mismos filtros de la pantalla) a CSV. Solo superadmin. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "superadmin") return new NextResponse("No autorizado", { status: 403 });

  const sp = new URL(request.url).searchParams;
  const { rows } = await getScanLog(
    {
      q: sp.get("q") ?? undefined,
      stopId: Number(sp.get("parada")) || undefined,
      adminId: Number(sp.get("admin")) || undefined,
      date: sp.get("fecha") ?? undefined,
      voided: sp.get("anulados") === "1",
    },
    100_000,
    0,
  );

  const header = ["Fecha", "Hora (Mendoza)", "DNI", "Apellido y nombre", "Curso", "Parada N°", "Parada", "Cargó", "Vía", "Salteó paradas", "Anulado"];
  const lines = rows.map((r) =>
    [
      formatDate(r.scannedAt), formatTime(r.scannedAt), r.dni, r.studentName, r.course ?? "", r.stopPosition, r.stopName,
      r.adminName ?? "", r.method, r.skippedPrevious ? "Sí" : "No", r.deletedAt ? "Sí" : "No",
    ].map(csv).join(","),
  );
  const body = "﻿" + [header.map(csv).join(","), ...lines].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registros-maraton.csv"`,
    },
  });
}
