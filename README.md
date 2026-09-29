# Maratón Escolar · Control de paradas

Aplicación web para registrar el paso de los alumnos por las paradas/etapas de una maratón escolar.
Se escanea el código de barras del DNI (lector USB, cámara del celular o carga manual), se guarda la
hora exacta (horario de Mendoza, Argentina) y se actualizan las estadísticas en vivo.

**Stack:** Next.js 16 (App Router) · React 19 · PostgreSQL · Tailwind CSS 4 · ZXing (cámara)

## Roles

| Rol | Puede |
| --- | --- |
| **Superadmin** | Todo lo de admin + crear/ordenar/desactivar **paradas**, crear/desactivar **administradores** y cambiar sus contraseñas, gestionar **alumnos** (alta, importar CSV, editar), ver **quién cargó cada dato y cuándo**, anular registros y exportar CSV. |
| **Admin** | Escanear/cargar alumnos, ver estadísticas, ver los registros que cargó él y la lista de alumnos. |

Los alumnos no tienen usuario: solo los administradores pueden iniciar sesión.

## Cómo funciona el escaneo

1. El admin escanea el DNI (o lo escribe). Si el alumno no tiene paradas se le asigna la **Parada 1**; luego la 2, y así.
2. Por defecto la parada es **“Automática”** (la siguiente de cada alumno). El admin puede elegir una parada fija en el selector.
3. Si la parada elegida **saltea** paradas anteriores, aparece una **alerta** con tres opciones: cargar en la parada que le corresponde, cargar igual, o cancelar.
4. Si el DNI no existe, se pide apellido/nombre/curso y se da de alta y registra en un solo paso.
5. Un alumno no puede pasar dos veces por la misma parada. Cada registro se puede **anular** (el propio admin durante 5 minutos, el superadmin siempre).
6. La hora se toma del servidor de base de datos en el momento del escaneo y se conserva aunque haya que confirmar una alerta.

Formatos de DNI aceptados: solo números (con o sin puntos), Code 39/128, y el PDF417 del DNI argentino.

## Zona horaria

Todas las fechas son `timestamptz` y la base queda configurada con `America/Argentina/Mendoza`
(`ALTER DATABASE … SET timezone`, lo hace `npm run db:migrate`). La aplicación además muestra y agrupa
siempre en horario de Mendoza, sin depender de la zona del servidor.

## Puesta en marcha (desarrollo)

```bash
npm install
cp .env.example .env        # completar DATABASE_URL y los datos del superadmin inicial
npm run db:migrate          # crea las tablas y fija la zona horaria
npm run db:seed             # crea el superadmin inicial (SUPERADMIN_* del .env)
npm run dev                 # (en producción, `npm start` ya hace el migrate/seed solo)
```

Después de entrar por primera vez, cambiá la contraseña en **Mi cuenta**.

## Despliegue en Coolify

1. **Nuevo recurso → Application** (repositorio público, o privado con GitHub App / Deploy Key).
2. **Build Pack:** Nixpacks · **Branch:** `main` · **Base Directory:** `/` · **Static site:** desactivado.
3. **Ports Exposes:** `3000`.
4. **Environment Variables** (runtime):
   - `DATABASE_URL` = cadena de conexión de PostgreSQL
   - `PORT` = `3000`
   - `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_FULL_NAME` (solo se usan para crear el primer superadmin)
   - Opcional: `NIXPACKS_NODE_VERSION` = `22`
5. **Domains:** `https://maraton.tudominio.com` (con el DNS apuntando a la VPS). Coolify emite el certificado solo.
6. **Deploy.** Al arrancar, `npm start` ejecuta `scripts/setup.mjs`: aplica el esquema, deja la base en horario de Mendoza y crea el superadmin si no existe ninguno.

Notas:

- **HTTPS es obligatorio para usar la cámara del celular** (los navegadores bloquean la cámara en sitios HTTP) y para la cookie de sesión segura.
- Dejar **una sola réplica**: el límite de intentos de login se guarda en memoria.
- Después de entrar por primera vez, cambiar la contraseña en **Mi cuenta** y borrar `SUPERADMIN_PASSWORD` de las variables.
- Si se sirve sin HTTPS por algún motivo, se puede definir `INSECURE_COOKIES=1` (no recomendado).

Sin Coolify (VPS a mano): `npm ci && npm run build && npm start` con las mismas variables, detrás de nginx/Caddy con HTTPS (que envíe `Host` y `X-Forwarded-For`).

## Lector de código de barras (“pistolita”)

Configurarlo en modo teclado USB (HID) con sufijo **Enter**. En la pantalla *Escanear* el campo de DNI
recupera el foco solo: basta con apuntar y disparar.

## Estructura

```
db/schema.sql          esquema (idempotente)
lib/scan.ts            lógica de paradas: siguiente, saltos, duplicados
lib/stats.ts           consultas de estadísticas
app/(app)/*            pantallas (escanear, estadísticas, registros, alumnos, paradas, admins, cuenta)
app/api/scan           endpoint de escaneo · /api/scan/undo anula · /api/export CSV
components/camera-scanner.tsx   lectura con la cámara (BarcodeDetector nativo o ZXing)
```
