import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db";
import { SESSION_COOKIE, SESSION_HOURS } from "./config";

export type Role = "superadmin" | "admin";
export type SessionUser = { id: number; username: string; fullName: string; role: Role };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, 11);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [sha256(token), userId, SESSION_HOURS],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual (o null). Se valida contra la base en cada request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<{ id: number; username: string; full_name: string; role: Role }>(
    `SELECT u.id, u.username, u.full_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [sha256(token)],
  );
  return row ? { id: row.id, username: row.username, fullName: row.full_name, role: row.role } : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "superadmin") redirect("/escanear");
  return user;
}

/** Protección CSRF básica para los endpoints JSON: el Origin debe coincidir con el Host. */
export async function isSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true; // llamadas del mismo sitio sin Origin (ej. GET)
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// --- Límite de intentos de login (en memoria, alcanza para un único proceso en la VPS) ---
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginRateKey(username: string, ip: string) {
  return `${ip}|${username.toLowerCase()}`;
}
export function isLoginBlocked(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}
export function registerLoginFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count++;
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
