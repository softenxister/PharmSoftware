
# Pharm

Retail pharmacy counter software built as a React Router 7 + Vite SPA with a same-origin Hono API and PostgreSQL/Prisma persistence.

## Development

1. Copy `.env.example` to `.env` and configure PostgreSQL.
2. Run `npm install`.
3. Run `npm run dev`.

The Vite UI runs at `http://127.0.0.1:3000`, the API runs at `http://127.0.0.1:3001`, and Vite proxies `/api` to keep browser requests same-origin.

## Production

Run `npm run build`, then `npm start`. One Node process serves the API, Vite assets, and the SPA route fallback on `PORT` (default `3000`). Set `HOST` when a deployment needs a specific bind address.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run build`
