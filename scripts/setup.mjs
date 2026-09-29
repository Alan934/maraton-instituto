// Se ejecuta antes de `next start`: aplica el esquema y crea el superadmin inicial si no existe ninguno.
// Es idempotente, así que puede correr en cada arranque/despliegue.
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";

const { DATABASE_URL, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD, SUPERADMIN_FULL_NAME } = process.env;
if (!DATABASE_URL) {
  console.error("[setup] Falta DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("[setup] Esquema aplicado.");

  const { rows } = await client.query("SELECT count(*)::int AS n FROM users WHERE role = 'superadmin'");
  if (rows[0].n > 0) {
    console.log("[setup] Ya existe un superadmin.");
  } else if (SUPERADMIN_USERNAME && SUPERADMIN_PASSWORD) {
    const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 11);
    await client.query(
      "INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, 'superadmin')",
      [SUPERADMIN_USERNAME, SUPERADMIN_FULL_NAME || "Superadministrador", hash],
    );
    console.log(`[setup] Superadmin "${SUPERADMIN_USERNAME}" creado.`);
  } else {
    console.warn("[setup] No hay superadmin y faltan SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD: nadie podrá ingresar.");
  }
} finally {
  await client.end();
}
