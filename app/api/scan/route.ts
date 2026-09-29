import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { parseDni } from "@/lib/dni";
import { registerScan } from "@/lib/scan";

const bodySchema = z.object({
  dni: z.string().min(1).max(200),
  stopId: z.number().int().positive().nullish(),
  force: z.boolean().optional(),
  method: z.enum(["scanner", "camera", "manual"]),
  scannedAt: z.string().optional(),
  newStudent: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      course: z.string().trim().max(40).nullish(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ status: "error", message: "Origen no permitido." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Sesión vencida. Volvé a iniciar sesión." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "error", message: "Solicitud inválida." }, { status: 400 });

  const dni = parseDni(parsed.data.dni);
  if (!dni) {
    return NextResponse.json({ status: "error", message: `No se pudo leer un DNI válido en "${parsed.data.dni.slice(0, 30)}".` });
  }

  try {
    const result = await registerScan({ ...parsed.data, dni }, user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("scan error", err);
    return NextResponse.json({ status: "error", message: "Error del servidor al registrar. Reintentá." }, { status: 500 });
  }
}
