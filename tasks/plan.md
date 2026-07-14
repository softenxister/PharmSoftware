# Implementation Plan: Owner and Pharmacist Accounts

## Overview

Deliver the confirmed account system as secure vertical slices while preserving the existing uncommitted POS/settings work.

## Architecture Decisions

- Add a separate `PharmAccount` identity model instead of repurposing sale-assignment Owner/Pharmacist records.
- Use opaque database-backed sessions; middleware supplies the pathname and the root server layout performs database session validation before protected UI renders.
- Remove the old environment identity after all call sites use async database-session resolution.
- Use one-time owner activation rather than a committed default credential.

## Task List

### Phase 1: Foundation

- [x] Define validation, password, session, public-account, and role contracts with failing tests.
- [x] Add additive Prisma models and a migration for owner activation, sessions, and login throttling.

### Checkpoint: Foundation

- [x] Focused auth tests pass.
- [x] Prisma generates and TypeScript passes.

### Phase 2: Authentication

- [x] Implement owner setup, login, logout, current-session resolution, and route protection.
- [x] Implement forced temporary-password replacement and session revocation.
- [x] Build the login and change-password screens.

### Checkpoint: Authentication

- [x] Unauthenticated routes redirect to login and authenticated users reach the application.
- [x] Login failures are generic and throttled.

### Phase 3: Account and Staff

- [x] Implement current Account read/update and account photo validation.
- [x] Implement owner-only Staff list/create/status/reset actions.
- [x] Build Account and Staff settings panels and owner-only sidebar visibility.

### Phase 4: Navigation and Store Separation

- [x] Replace the top-right profile button with an accessible logout-only menu.
- [x] Make Store Profile wording business-only and keep it read-only as previously requested.
- [x] Remove the environment/admin identity path and update role consumers.

### Checkpoint: Complete

- [x] Migration applied; tests, TypeScript, production build, live route checks, and diff checks pass.
- [ ] Login, owner, and pharmacist flows exercised visually in the browser (Chrome DevTools MCP unavailable in this session).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing running Prisma client is stale after migration | High | Generate client and restart/verify live routes; use parameterized raw queries only where hot reload requires it. |
| Authentication locks out the current installation | High | One-time owner setup appears automatically until the owner activates credentials. |
| Role migration changes stock behavior | High | Keep explicit owner-only guards and regression tests for pharmacist pending approval. |
| Large profile images destabilize storage/UI | Medium | Validate MIME signature and cap encoded size; fixed avatar dimensions and object-fit. |
| Existing dirty worktree is overwritten | High | Patch only scoped files and do not reset, checkout, or commit unrelated changes. |

## Open Questions

- None. The user explicitly approved the interview restatement; necessary bootstrap/session/image assumptions are recorded in the spec.

---

# Implementation Plan: React Router 7 + Vite SPA Migration

## Overview

Replace the Next.js runtime without changing pharmacy behavior, API contracts, authentication security, or persisted data. Land the migration in independently verifiable slices and preserve the existing dirty worktree.

## Task List

### Phase 1: Contract and Runtime Foundation

- [x] Inventory pages, API handlers, Next-only imports, auth boundaries, and build scripts.
- [x] Record the migration architecture, security boundary, compatibility requirements, and rollback plan.
- [x] Add Vite, React Router, and the lightweight Node server foundation.

### Phase 2: Browser Routing

- [x] Add the SPA entry, authentication provider, route guards, app shell, and lazy route definitions.
- [x] Convert page wrappers, links, navigation calls, locations, and query parameters to React Router.
- [x] Remove server-only code from the browser module graph.

### Phase 3: API Runtime

- [x] Convert Next responses and cookies to standard Web `Response` and request-scoped cookie helpers.
- [x] Register every existing method/path on the Node server.
- [x] Add production static hosting, SPA fallback, body limits, and security headers.

### Phase 4: Retirement and Verification

- [x] Remove Next configuration, middleware, generated files, and dependencies.
- [x] Run tests, TypeScript, client/server builds, runtime API/SPA smoke tests, and diff checks.
- [x] Check for configured browser control and record that Chrome DevTools/browser control was unavailable in this session.

## Compatibility Checkpoints

- No database schema or migration changes.
- No `/api/*` response contract changes.
- HttpOnly database sessions and role authorization remain server-side.
- All existing desktop/tablet routes and workflows remain reachable.
- Nested route refreshes work from the production server.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Server-only module leaks into the browser bundle | High | Route only through UI modules; verify production chunks and imports. |
| Cookie behavior changes while removing Next helpers | High | Add focused cookie/request-context tests and preserve exact attributes. |
| API path or method is omitted | High | Use an explicit route registry and parity tests. |
| SPA refresh returns 404 | High | Production fallback test for nested routes. |
| Auth guard flickers or loops | High | Centralize the session state machine and test redirect decisions. |
| Existing dirty work is lost | High | Use scoped patches only; never reset or checkout user changes. |
