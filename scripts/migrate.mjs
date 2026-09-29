import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const tz = await client.query("SHOW timezone");
  const now = await client.query("SELECT now()::text AS now");
  console.log("Migración aplicada.");
  console.log("Zona horaria de la sesión:", tz.rows[0].TimeZone);
  console.log("Hora actual en la base:", now.rows[0].now);
} finally {
  await client.end();
}
