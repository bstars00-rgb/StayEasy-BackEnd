# StayEasy BackEnd

Node.js prototype API for the StayEasy frontend.

## Run locally

```bash
npm install
npm start
```

Health check:

```text
GET /api/v1/health
```

Default port is `8787`. Hosting platforms can override it with `PORT`.

## Frontend env

```text
VITE_API_BASE_URL=https://your-backend-host
VITE_API_PREFIX=/api/v1
```

## Current scope

- Demo Google login exchange
- Membership catalog and compare API
- Wallet and voucher availability
- Reservations
- Orders and settlement summary
- Transfers
- Assistance requests
- Quiz recommendations

Data is in-memory for the prototype. Production should replace it with PostgreSQL and server-side Google token verification.
