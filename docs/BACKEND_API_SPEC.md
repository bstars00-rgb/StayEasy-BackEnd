# OhmySelect Backoffice Backend API Spec

Base URL: `/api/v1`

Authentication: `Authorization: Bearer <accessToken>`.

Backoffice roles:
- `ADMIN_EMAILS`: full admin permission.
- `OPERATOR_EMAILS`: read plus reservation and assistance handling.

CORS preflight must include:
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, Content-Type`

## Existing consumer/admin contract preserved

Existing endpoints remain available:
- `POST /auth/google`
- `GET /me`, `GET /auth/me`, `POST /auth/logout`
- `GET /cities`
- `GET /memberships`, `GET /memberships/:id`, `GET /memberships/compare?ids=`
- `GET /memberships/:id/vouchers`
- `GET /wallet`, `POST /wallet/memberships`, `DELETE /wallet/memberships/:id`, `GET /wallet/vouchers`
- `GET/POST /reservations`, `PATCH /reservations/:id/status`, `DELETE /reservations/:id`
- `GET/POST /orders`, `PATCH /orders/:id/status`
- `GET/POST /transfers`
- `POST /assistance-requests`
- `POST /recommendations/quiz`
- `GET /settlements/summary`
- Existing admin UI endpoints: `GET /admin/orders`, `PATCH /admin/orders/:id/status`, `GET /admin/reservations`, `PATCH /admin/reservations/:id/status`, `GET /admin/assistance-requests`, `PATCH /admin/assistance-requests/:id`, `GET /admin/settlements/summary`

## New backoffice endpoints

- `GET /admin/me`
- `GET /admin/dashboard?from=&to=`
- `GET /admin/audit-logs?from=&to=&actor=&page=&pageSize=`
- `GET /admin/users?q=&page=&pageSize=`
- `GET /admin/users/:id`
- `GET /admin/memberships?q=&brand=&page=&pageSize=`
- `POST /admin/memberships` admin only
- `GET /admin/memberships/:id`
- `PATCH /admin/memberships/:id` admin only
- `DELETE /admin/memberships/:id` admin only, soft delete via `active:false`
- `GET /admin/memberships/:id/vouchers`
- `POST /admin/memberships/:id/vouchers` admin only
- `PATCH /admin/vouchers/:templateId` admin only
- `DELETE /admin/vouchers/:templateId` admin only
- `GET /admin/vouchers/:templateId/usage`
- `GET /admin/vouchers/:templateId/availability`
- `PUT /admin/vouchers/:templateId/availability` admin only
- `GET /vouchers/:templateId/availability` public read for calendar UI
- `GET /admin/holidays?country=&page=&pageSize=`
- `POST /admin/holidays` admin only
- `PATCH /admin/holidays/:id` admin only
- `DELETE /admin/holidays/:id` admin only
- `GET /admin/reports/orders.csv?from=&to=&status=`
- `GET /admin/reports/settlements.csv?from=&to=`

## Dashboard response

```json
{
  "currency": "VND",
  "gmv": 0,
  "commission": 0,
  "orders": { "total": 0, "byStatus": { "requested": 0, "invoiced": 0, "paid": 0, "activated": 0, "cancelled": 0 } },
  "reservations": { "total": 0, "byStatus": { "requested": 0, "confirmed": 0, "completed": 0, "cancelled": 0 } },
  "assistance": { "open": 0, "handled": 0 },
  "activeMemberships": 0,
  "expiringVouchers": 0
}
```

## Availability

`GET /admin/vouchers/:templateId/availability` and `GET /vouchers/:templateId/availability` return:

```json
{
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
  "minLeadDays": 0,
  "maxAdvanceDays": 120,
  "blackouts": [{ "from": "2026-02-14", "to": "2026-02-22", "key": "tet", "label": "Tet 2026" }],
  "validUntil": "2026-11-30"
}
```

`POST /reservations` validates server-side availability. Unavailable dates return 409:

```json
{
  "code": "DATE_NOT_AVAILABLE",
  "message": "Date is not available.",
  "details": { "ok": false, "reason": "blackout", "holidayKey": "tet" }
}
```

Possible reasons: `invalid`, `leadTime`, `tooFar`, `expired`, `blackout`, `weekend`, `closed`.

## Pagination

New list endpoints return:

```json
{
  "items": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0 }
}
```

Compatibility exception: `GET /admin/assistance-requests` with no query string still returns the existing array shape. With filters/pagination query, it returns `{ items, meta }`.

## Settlement

`GET /admin/settlements/summary?from=&to=&brand=` preserves existing summary fields and adds:

```json
{
  "byBrand": [{ "membershipId": "club-marriott-vietnam", "gmv": 4200000, "commission": 504000, "orders": 1 }],
  "byPeriod": [{ "date": "2026-06-09", "gmv": 4200000, "commission": 504000 }]
}
```
