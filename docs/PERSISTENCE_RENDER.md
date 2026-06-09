# StayEasy backend persistence on Render

The backend keeps the existing Render deployment shape:

- start command: `npm start`
- entrypoint: `server.js`
- API base: `/api/v1`

## Modes

- Without `DATABASE_URL`: in-memory prototype mode.
- With `DATABASE_URL`: PostgreSQL/Supabase persistence mode.

In persistence mode the server creates one table automatically:

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

The app state is saved after mutations and restored on server boot. Browser tokens are still short-lived prototype tokens, so users should sign in again after a deploy/restart.

## Render environment variables

Set these in Render > StayEasy-BackEnd > Environment:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
ADMIN_EMAILS=demo.user@gmail.com,demo-gle-user@stayeasy.local
```

For Supabase, use the project connection string from Supabase Database settings. The server enables SSL by default for PostgreSQL. If a local database does not use SSL, set:

```env
PGSSLMODE=disable
```

## Verify

Open:

```text
https://stayeasy-backend-g3z0.onrender.com/api/v1/health
```

Expected when `DATABASE_URL` is configured:

```json
{
  "ok": true,
  "service": "stayeasy-backend",
  "persistence": "postgres"
}
```

Expected without `DATABASE_URL`:

```json
{
  "ok": true,
  "service": "stayeasy-backend",
  "persistence": "memory"
}
```
