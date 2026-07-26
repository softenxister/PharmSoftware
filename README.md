
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

## Architecture

This is a client-routed Vite application, not a file-routed Next.js application.

```text
.
├── src/           browser application
├── server/        Hono API and all backend implementation
├── prisma/        database schema, migrations, and seed data
├── scripts/       developer and data-maintenance commands
├── data/          generated normalization reports and backups
├── docs/          decisions, guides, plans, reports, and research
└── public/        static browser assets

src/
├── app/          application shell, providers, router, and routing policy
├── pages/        lazy-loaded React Router entry points
├── features/     pharmacy workflows and their private UI/logic
├── components/   UI shared by multiple features
├── api/          browser API clients shared by multiple features
├── config/       shared validated application configuration
├── hooks/        hooks shared by multiple features
├── i18n/         shared localization
└── lib/          shared domain and interaction logic

server/
├── routes/       thin HTTP request handlers
├── auth/         authentication and authorization
├── db/           Prisma repositories and persistence mapping
├── import/       migration parsing and normalization
├── composition/  product-composition enrichment
├── product-images/
├── receipts/
├── generated/    generated Prisma client (not committed)
├── apiRegistry.ts
├── app.ts
└── index.ts
```

Dependencies flow from shared modules into features, and from features into pages. Shared modules must not import feature implementations. A module used by only one feature stays colocated with that feature; promote it to a shared folder only when another feature needs it.

See [ADR-001](docs/decisions/001-vite-feature-architecture.md) for the rationale and concrete placement rules.

Root configuration files remain at the root because Vite, TypeScript, Prisma, PostCSS, package managers, and deployment platforms discover them there. `README.md`, `CONTEXT.md`, and `agents.md` also stay at the root so humans and development tools can find project context immediately.
