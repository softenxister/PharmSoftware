# Spec: Owner and Pharmacist Accounts

## Objective

Replace the environment-variable demo identity with individual owner and pharmacist accounts. The owner can create and manage pharmacist access, every user can maintain their own personal profile, Store Profile contains business information only, and changing users always requires logout and a new login.

## Confirmed User Flow

- The current primary account becomes the single Owner account.
- On an unconfigured installation, `/login` presents a one-time owner setup form instead of shipping a preset password.
- The owner creates Pharmacist accounts with a username and temporary password.
- Pharmacists must replace a temporary password after their first successful login or after an owner password reset.
- The top-right profile control contains only Log out; there is no account switcher.
- Account is available to owner and pharmacist. Staff is visible and accessible only to the owner.
- Pharmacists keep their current POS permissions and stock changes continue through owner approval.

## Tech Stack

- React Router 7.18 + React 19.2 client SPA built with Vite 8.1
- Hono 4.12 on Node for same-origin API and production static serving
- Prisma 7.8 with PostgreSQL
- Node 26 `crypto.scrypt`, `randomBytes`, SHA-256, and `timingSafeEqual`
- Existing CSS Modules and pharmacy-green visual system

## Commands

- Tests: `npm test`
- Type check: `npm run typecheck`
- Production bundles: `npm run build`
- Prisma client: `node node_modules/prisma/build/index.js generate`
- Database deploy: `node node_modules/prisma/build/index.js migrate deploy`
- Whitespace: `git diff --check`
- Do not run npm commands unless the user explicitly requests them.

## Project Structure

- `server/auth/` — validation, password hashing, session resolution, role guards
- `server/db/` — parameterized account/session/rate-limit persistence
- `src/app/api/auth/` — owner setup, login, logout, password change
- `src/app/api/account/` — current-user profile and password updates
- `src/app/api/staff/` — owner-only pharmacist management
- `src/app/login/` and `src/app/change-password/` — authentication screens
- `src/app/settings/` — Account, Staff, and business-only Store Profile panels
- `prisma/migrations/` — additive account/session/rate-limit migration

## Code Style

```ts
const account = await requireAuthenticatedUser();
if (account.role !== "owner") {
  return Response.json({ error: "Permission denied." }, { status: 403 });
}
```

- Validate every request body at the route boundary.
- Return allowlisted account fields only; never return password or session hashes.
- Keep role names user-facing and canonical: `owner` and `pharmacist`.

## Threat Model

- Assets: password hashes, session tokens, personal profile data, owner-only staff actions.
- Spoofing: passwords use scrypt with a unique 16-byte salt; sessions use 32 random bytes.
- Tampering/elevation: every Account and Staff mutation resolves the server session; Staff endpoints also require owner role.
- Disclosure: raw session tokens exist only in HTTP-only cookies; database stores token hashes; login errors are generic.
- Brute force: failed logins are rate-limited by a hashed normalized username.
- Revocation: logout deletes the current session; password changes, password resets, and deactivation delete affected sessions.
- Upload abuse: account images are restricted to validated PNG/JPEG/WebP data images with a strict size cap.

## Testing Strategy

- Unit tests for validation, role policy, password hashing, rate limiting, and public account mapping.
- Repository/API behavior checked through focused route calls where the running application permits it.
- Browser verification at desktop and tablet widths, keyboard flow, accessibility tree, network, and console when Chrome DevTools MCP is available.

## Boundaries

- Always: hash passwords, validate input, parameterize queries, use HTTP-only SameSite cookies, authorize on the server, revoke sessions on credential/status changes.
- Ask first: add external storage, email/SMS delivery, password recovery, a second owner/admin role, or a third-party identity provider.
- Never: preset or commit a password, expose hashes/tokens, store auth tokens in localStorage, allow client role changes, or let a pharmacist access Staff management.

## Success Criteria

- Owner setup/login/logout and forced pharmacist password change work end to end.
- Owner can create, list, deactivate/reactivate, and reset Pharmacist accounts.
- Account saves only the signed-in user’s allowed fields and exposes role read-only.
- Staff is absent for pharmacists and its API returns 403 for pharmacist sessions.
- Store Profile labels and fields describe the pharmacy business only.
- Existing POS and pending stock-approval behavior remains intact.
- Tests, TypeScript, migration deploy, and `git diff --check` pass.

## Out of Scope

- Additional owners or administrators
- Pharmacy-helper roles
- Self-registration after initial owner setup
- In-app account switching
- Password recovery by email/SMS
- External identity providers or cloud image storage

## Official Sources

- React Router data routing: https://reactrouter.com/start/data/routing
- Vite production builds: https://vite.dev/guide/build
- Hono Node adapter: https://hono.dev/docs/getting-started/nodejs
- Node crypto: https://nodejs.org/api/crypto.html
- Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
