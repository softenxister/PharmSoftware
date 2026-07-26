# ADR-001: Use a Vite page-and-feature architecture

## Status

Accepted

## Date

2026-07-26

## Context

Pharm is a React Router 7 single-page application built by Vite, with a separate Hono/Node server. Its source tree previously used Next.js-shaped names:

- route entry points lived in `src/app/**/page.tsx`;
- server request handlers lived in `src/app/api/**/route.ts`;
- reusable UI lived inside an unrelated `features/events` folder;
- feature screens, application providers, shared configuration, and server-facing domain logic were mixed under `src/app`.

Those locations made the runtime model harder to see and made unrelated files appear coupled. The application already uses explicit React Router configuration and Vite route-level lazy imports, so filesystem routing conventions provide no value.

The structure follows the progressive guidance in Robin Wieruch's [React Folder Structure Best Practices](https://www.robinwieruch.de/react-folder-structure/) and the project's Vite architecture guidance: use pages as SPA entry points, colocate single-feature code, and promote code only when it is genuinely shared.

## Decision

Use these module locations:

- `src/app`: application composition only—router, providers, application shell, and route policy.
- `src/pages`: one lazy-loaded entry module per user-facing route. Pages compose feature modules and shared modules.
- `src/features/<feature>`: UI, hooks, clients, tests, styles, and utilities owned by one pharmacy workflow.
- `src/components`: presentation shared by at least two features or by the application shell.
- `src/api`: browser API clients used by multiple features.
- `src/config`, `src/hooks`, `src/i18n`, and `src/lib`: technical shared modules with clear cross-feature use.
- `server/routes`: HTTP request handlers registered by `server/apiRegistry.ts`.
- `server/auth`, `server/db`, `server/import`, `server/composition`, `server/product-images`, and `server/receipts`: all server-only implementation.
- `server/generated/prisma`: the generated Prisma client, colocated with its only runtime consumer and excluded from Git.
- `prisma`: the conventional Prisma schema, migration, and seed directory.
- `scripts/data-maintenance`: manually run data maintenance commands.
- `data/outputs`: generated normalization reports and recoverable data backups.
- `docs`: project decisions, guides, plans, reports, and research.

The dependency direction is:

```text
shared modules → features → pages → app router
server implementation → server routes → API registry → server app
```

Feature modules do not import other feature modules. When two features need the same module, move that module to the smallest appropriate shared folder. Direct file imports are preferred over broad barrel files so the interface and lazy-loading graph remain visible.

`@/*` resolves browser application modules under `src`. `@server/*` resolves server modules and is used by browser code only for erased TypeScript type imports; runtime browser imports from `@server` are not allowed.

## Alternatives Considered

### Keep the Next.js-shaped `src/app` tree

Rejected because Vite and React Router do not use `page.tsx` or `route.ts` conventions. The names obscure the actual router and server registry.

### Group everything by technical type

Rejected because one large `components`, `hooks`, or `utils` namespace would separate feature implementation and reduce locality. Technical top-level folders are reserved for code that truly crosses feature seams.

### Introduce domains, packages, or a monorepo

Rejected for now because the application has a single deployable web client and a manageable set of pharmacy features. Those layers would add navigation and interface overhead without current leverage.

### Add public `index.ts` files to every folder

Rejected as a blanket rule. Direct imports keep ownership and route chunks visible. A focused public interface can be added later when a feature develops multiple external callers.

## Consequences

- Route-level lazy loading remains explicit in `src/app/router.tsx`.
- Deleting or editing a pharmacy workflow is localized under `src/features`.
- Shared code has an evidence-based placement rule instead of becoming a dumping ground.
- Server routes no longer look like Next.js route handlers.
- Browser and backend code no longer occupy separate `server` and `src/server` trees.
- Moving a module between feature and shared layers requires import updates, but aliases keep those changes readable.
