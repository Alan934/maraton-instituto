import bcrypt from "bcryptjs";
import pg from "pg";

const { DATABASE_URL, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD, SUPERADMIN_FULL_NAME } = process.env;
if (!DATABASE_URL || !SUPERADMIN_USERNAME || !SUPERADMIN_PASSWORD) {
  throw new Error("Faltan DATABASE_URL, SUPERADMIN_USERNAME o SUPERADMIN_PASSWORD en el .env");
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const exists = await client.query("SELECT id FROM users WHERE lower(username) = lower($1)", [SUPERADMIN_USERNAME]);
  if (exists.rowCount) {
    console.log(`El usuario "${SUPERADMIN_USERNAME}" ya existe. No se modificó nada.`);
  } else {
    const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 11);
    await client.query(
      "INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, 'superadmin')",
      [SUPERADMIN_USERNAME, SUPERADMIN_FULL_NAME || "Superadministrador", hash],
    );
    console.log(`Superadmin "${SUPERADMIN_USERNAME}" creado.`);
  }
} finally {
  await client.end();
}
