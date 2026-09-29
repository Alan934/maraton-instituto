-- Esquema de la base de datos (idempotente: se puede ejecutar varias veces).
-- Todas las fechas son timestamptz; la base queda configurada en horario de
-- Mendoza, Argentina (America/Argentina/Mendoza, UTC-3).

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Argentina/Mendoza');
END $$;

SET timezone TO 'America/Argentina/Mendoza';

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  username      text        NOT NULL,
  full_name     text        NOT NULL,
  password_hash text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('superadmin', 'admin')),
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    integer     REFERENCES users (id) ON DELETE SET NULL,
  last_login_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  id         serial PRIMARY KEY,
  token_hash text        NOT NULL UNIQUE,
  user_id    integer     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS stops (
  id          serial PRIMARY KEY,
  position    integer     NOT NULL,
  name        text        NOT NULL,
  description text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  integer     REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT stops_position_key UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS students (
  id         serial PRIMARY KEY,
  dni        text        NOT NULL UNIQUE,
  first_name text        NOT NULL,
  last_name  text        NOT NULL,
  course     text,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by integer     REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS students_course_idx ON students (course);

CREATE TABLE IF NOT EXISTS scans (
  id               bigserial PRIMARY KEY,
  student_id       integer     NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  stop_id          integer     NOT NULL REFERENCES stops (id) ON DELETE RESTRICT,
  scanned_by       integer     REFERENCES users (id) ON DELETE SET NULL,
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  method           text        NOT NULL CHECK (method IN ('scanner', 'camera', 'manual')),
  -- true si el admin cargó al alumno salteando una o más paradas anteriores
  skipped_previous boolean     NOT NULL DEFAULT false,
  deleted_at       timestamptz,
  deleted_by       integer     REFERENCES users (id) ON DELETE SET NULL
);
-- Un alumno solo puede pasar una vez por cada parada (ignorando registros anulados).
CREATE UNIQUE INDEX IF NOT EXISTS scans_student_stop_key
  ON scans (student_id, stop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS scans_scanned_at_idx ON scans (scanned_at);
CREATE INDEX IF NOT EXISTS scans_scanned_by_idx ON scans (scanned_by);
CREATE INDEX IF NOT EXISTS scans_stop_idx ON scans (stop_id);
