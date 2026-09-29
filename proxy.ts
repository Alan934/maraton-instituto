import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

// Chequeo optimista: sin cookie de sesión se redirige al login.
// La validación real de la sesión se hace contra la base de datos en cada página/endpoint.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname === "/login") return NextResponse.next(); // la propia página redirige si la sesión es válida
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
