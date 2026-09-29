"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearLoginFailures, clientIp, createSession, destroySession, isLoginBlocked,
  hashPassword, loginRateKey, registerLoginFailure, verifyPassword,
} from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export type LoginState = { error?: string; username?: string };

const schema = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });

// Hash de relleno para que el tiempo de respuesta no revele si el usuario existe.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("relleno-anti-timing"));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { error: "Ingresá usuario y contraseña." };
  const { username, password } = parsed.data;

  const key = loginRateKey(username, await clientIp());
  if (isLoginBlocked(key)) return { error: "Demasiados intentos. Esperá unos minutos e intentá de nuevo.", username };

  const user = await queryOne<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(username) = lower($1) AND active",
    [username],
  );
  const ok = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !ok) {
    registerLoginFailure(key);
    return { error: "Usuario o contraseña incorrectos.", username };
  }

  clearLoginFailures(key);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await createSession(user.id);
  redirect("/escanear");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
