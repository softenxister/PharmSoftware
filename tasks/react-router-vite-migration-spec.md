# React Router 7 + Vite SPA Migration Specification

## Goal

Replace the Next.js application runtime with a fast client-rendered React Router 7 + Vite SPA while preserving the current pharmacy workflows, authorization rules, PostgreSQL/Prisma data model, and `/api/*` request and response contracts.

## Scope

### In scope

- Replace Next App Router page routing with React Router 7 data routing.
- Replace Next development/build/start commands with Vite and a lightweight Node server.
- Keep all API operations server-side and expose them at their existing `/api/*` paths.
- Keep authentication in an opaque, database-backed, HttpOnly cookie session.
- Preserve owner/pharmacist route and action authorization.
- Preserve every current screen and desktop/tablet layout.
- Add SPA route fallback, security headers, request-body limits, and graceful server shutdown.
- Remove Next-only files, imports, dependencies, and generated-type configuration.

### Out of scope

- Database or Prisma schema changes.
- API contract redesign.
- Visual redesign or mobile-first layout work.
- Authentication provider changes.
- Offline-first storage, service workers, or multi-tenant data isolation changes.
- Deployment-provider selection.

## Users and Required Behavior

- Unauthenticated visitors may only use `/login` and are redirected there from protected routes.
- Authenticated users are redirected away from `/login`.
- Accounts with `mustChangePassword` may only use `/change-password` until the password is changed.
- Authenticated accounts that do not need a password change are redirected away from `/change-password`.
- The normal application shell and top navigation appear only around protected application routes.
- Owner-only UI and API permissions remain owner-only. Pharmacist behavior remains unchanged.
- Direct visits and browser refreshes on any SPA path return the application, not a 404.

## Architecture Contract

### Browser

- `createBrowserRouter` is created once outside React and rendered with `RouterProvider`.
- A single authentication provider loads `/api/current-user`, guards routes, and keeps the top bar and settings account data synchronized.
- Routes use React Router links, navigation, location, and search-parameter APIs.
- Route modules are lazy-loaded so the initial login/app shell bundles stay small.

### Development

- Vite serves the SPA at `http://localhost:3000`.
- The Node API runs at `http://localhost:3001`.
- Vite proxies `/api` to the Node API so browser requests remain same-origin from the application's perspective.

### Production

- One Node process serves `/api/*`, Vite-built static assets, and the SPA fallback from the same origin.
- Prisma, password hashing, session lookup, and repositories are never included in the browser bundle.
- Static assets use cache-friendly headers; `index.html` is not long-term cached.

## API Compatibility

- Existing route handler method signatures remain based on standard Web `Request` and `Response` objects.
- Paths, HTTP methods, status codes, and JSON payload shapes stay unchanged.
- A request-scoped context supplies the active request to existing session helpers without global mutable request state.
- Session cookie creation and clearing preserve `HttpOnly`, `SameSite=Lax`, `Path=/`, expiry/max-age, and production-only `Secure` behavior.

## Security Requirements

- No permissive cross-origin API configuration; the browser and API share an origin.
- Apply secure response headers and a CSP compatible with the current UI assets.
- Limit API request bodies and return `413` for oversized requests.
- Never expose database, session, password, or Prisma code to Vite's browser graph.
- Preserve validation, generic login failures, login throttling, session revocation, and server-side role checks.
- Static file serving must not allow path traversal.

## Acceptance Criteria

- All 17 current page URLs render through React Router.
- All 14 existing API endpoints are registered with their current HTTP methods.
- Login, logout, forced password change, current-user loading, owner-only actions, purchase, sales, and stock APIs retain their behavior.
- Top navigation and in-app links do not trigger full document reloads.
- Query-driven purchase, sales, and stock-adjustment screens still receive their URL state.
- A direct request to a nested client route returns `index.html` in production.
- No source file imports `next/*`, and `next` is absent from dependencies.
- Unit/integration tests, TypeScript, Vite client build, Vite server build, runtime smoke checks, and `git diff --check` pass.
- Changed screens are verified at desktop and tablet widths with the configured browser tool when available; otherwise the handoff explicitly records that visual verification was unavailable.

## Migration and Rollback

- The migration changes framework/runtime files but does not modify application data.
- Existing Prisma migrations remain valid and are not rewritten.
- The prior framework can be restored from version control without a database rollback because no schema migration is part of this change.
- Do not combine or discard unrelated dirty-worktree changes.

## Primary References

- React Router data routing: https://reactrouter.com/start/data/routing
- React Router custom Vite client rendering: https://reactrouter.com/start/data/custom
- Vite production and server builds: https://vite.dev/guide/ssr.html#building-for-production
- Hono on Node.js and static files: https://hono.dev/docs/getting-started/nodejs
- Hono secure headers: https://hono.dev/docs/middleware/builtin/secure-headers
- Hono body limits: https://hono.dev/docs/middleware/builtin/body-limit
