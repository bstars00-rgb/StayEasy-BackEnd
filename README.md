# OhmySelect / StayEasy BackEnd

Node.js API for the OhmySelect (StayEasy) frontend + `/admin/` back-office console.
Ported from the shared `StayEasy/backend/` (the implementation validated by the
frontend's `e2e:api` suite). Self-bootstrapping normalized schema; no manual SQL.

- `server.js` — HTTP router (`/api/v1`), auth, role gating, CORS.
- `db.js` — `OhmySelectStore`: Postgres adapter (Supabase) with a SQLite fallback,
  idempotent migrations, and catalog/availability/holiday seeding.
- `src/data/*`, `src/utils/vouchers.js` — seed catalog (ids match the frontend).

## Run locally

```bash
npm install
npm start          # SQLite fallback at .data/stayeasy.sqlite
npm run smoke      # boots the server and checks the full contract
```

Default port is `8787` (`PORT` overrides). Health: `GET /api/v1/health` →
`{ ok, persistence: "postgres" | "sqlite", ... }`.

## Environment variables (set on Render)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction Pooler** URL (IPv4). Empty → SQLite fallback. |
| `ADMIN_EMAILS` | Comma-separated admin emails (full back-office). |
| `OPERATOR_EMAILS` | Comma-separated operator emails (read + CS writes only). |
| `CORS_ORIGIN` | Allowed origin, e.g. `https://bstars00-rgb.github.io`. Default `*`. |
| `PORT` | Provided by Render. |

`ADMIN_EMAILS` takes precedence over `OPERATOR_EMAILS`. The Supabase **direct**
host (`db.<ref>.supabase.co:5432`) can fail on Render over IPv6 — use the
**pooler** host (`...pooler.supabase.com:6543`). `db.js` also resolves the host
to IPv4 and sets `ipv4first` as a safety net.

> Use the Supabase Transaction Pooler connection string for `DATABASE_URL`; the
> password is set only in the Render dashboard, never committed.

## Roles

- **admin** — full CRUD on catalog / vouchers / availability / holidays + all reads + CS writes.
- **operator** — all back-office reads + CS writes (order/reservation/assistance status);
  catalog/voucher/availability/holiday writes return `403 ADMIN_REQUIRED`.
- No login → `401 AUTH_REQUIRED`; no role → `403 ADMIN_REQUIRED`.
- `POST /api/v1/auth/google` returns `user.role` = `admin | operator | null`.

## Frontend env

```text
VITE_API_BASE_URL=https://stayeasy-backend-g3z0.onrender.com
VITE_API_PREFIX=/api/v1
```

## API surface

See `docs/BACKEND_API_SPEC.md` for the full contract (consumer + `/admin/*`),
including voucher `i18n` persistence and server-side reservation availability
(`409 DATE_NOT_AVAILABLE`).
