import pg from "pg";

const globalForPg = globalThis as unknown as { pgPool?: pg.Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta la variable DATABASE_URL");
  const pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  // La zona horaria (Mendoza) está fijada a nivel base de datos por db/schema.sql; además,
  // las consultas que agrupan por día/hora usan AT TIME ZONE de forma explícita.
  pool.on("error", (err) => console.error("pg pool error", err));
  return pool;
}

export const pool = globalForPg.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
