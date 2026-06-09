# StayEasy backend persistence on Render

The backend keeps the existing Render deployment shape:

- start command: `npm start`
- entrypoint: `server.js`
- API base: `/api/v1`

## Modes

- Without `DATABASE_URL`: in-memory prototype mode.
- With `DATABASE_URL`: PostgreSQL/Supabase persistence mode.

In persistence mode the current deploy repo creates one table automatically:

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

The app state is saved after mutations and restored on server boot. Browser tokens are still short-lived prototype tokens, so users should sign in again after a deploy/restart.

This is prototype-level persistence. The next backend step is migrating from the `app_state` snapshot into the normalized tables described in `DATABASE_SCHEMA.md` while keeping the existing frontend and `/admin` API shapes unchanged.

## Render environment variables

Set these in Render > StayEasy-BackEnd > Environment:

```env
DATABASE_URL=postgresql://postgres.ijqvaslluqpkndxflifq:<DB_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
ADMIN_EMAILS=demo.user@gmail.com,demo-gle-user@stayeasy.local
CORS_ORIGIN=https://bstars00-rgb.github.io
NODE_ENV=production
```

Use the Supabase **Transaction pooler** connection string on Render. The direct Supabase host can resolve to IPv6 from Render and fail with `ENETUNREACH`:

```text
postgresql://postgres:[YOUR-PASSWORD]@db.ijqvaslluqpkndxflifq.supabase.co:5432/postgres
```

Do not commit the real database password. Keep it only in Render environment variables.

The server enables SSL by default for PostgreSQL. If a local database does not use SSL, set:

```env
PGSSLMODE=disable
```

## Normalized schema bootstrap

Step 1 of the no-downtime migration is to create the normalized tables beside the existing `app_state` table. This does **not** switch API reads/writes yet, so the live admin UI keeps working from the current snapshot persistence.

### Option A: Supabase SQL Editor, recommended for free Render

Render Shell is not available on free instance types. Use this path instead:

1. Open Supabase project.
2. Go to `SQL Editor`.
3. Open `sql/normalized-schema.sql` from this repo.
4. Paste the whole SQL into Supabase SQL Editor.
5. Click `Run`.

Expected result: the query completes without errors and the tables below appear in Supabase Table Editor.

### Option B: Render Shell, paid Render instances only

Run from Render Shell after a successful deploy:

```bash
npm run db:init
```

Expected output:

```text
Normalized schema is ready
```

Tables created by this step:

- `users`
- `cities`
- `memberships`
- `membership_cities`
- `membership_hotels`
- `membership_tags`
- `membership_scores`
- `voucher_templates`
- `voucher_template_hotels`
- `voucher_availability`
- `holidays`
- `user_memberships`
- `voucher_usage`
- `reservations`
- `orders`
- `transfers`
- `assistance_requests`
- `audit_logs`

After this step, the next backend migration can dual-write from API mutations into these normalized tables, then switch reads endpoint-by-endpoint while keeping existing response shapes unchanged.

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

If `persistence` is `memory` and `persistenceError` is present, fix `DATABASE_URL` first and then trigger Render Manual Deploy.
