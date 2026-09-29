import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, APP_SUBTITLE } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/escanear");

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Fondo dividido azul / amarillo como el escudo */}
      <div aria-hidden className="absolute inset-0 -z-10 flex">
        <div className="w-1/2 bg-brand-500" />
        <div className="w-1/2 bg-sun-300" />
      </div>
      <div aria-hidden className="absolute -z-10 size-[42rem] rounded-full bg-sun-400/50 blur-3xl" />

      <div className="card pop w-full max-w-sm p-7 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark size={64} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900">{APP_NAME}</h1>
          <p className="text-sm text-[color:var(--muted)]">{APP_SUBTITLE}</p>
        </div>
        <LoginForm />
        <p className="mt-5 text-center text-xs text-[color:var(--muted)]">Acceso solo para personal autorizado.</p>
      </div>
    </main>
  );
}
