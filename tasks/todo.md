# Owner and Pharmacist Accounts

- [x] Auth contracts and tests
  - Acceptance: canonical owner/pharmacist roles, validated credentials/profile input, scrypt verification, safe public mapping.
  - Verify: focused auth tests fail before implementation and pass afterward.
  - Files: `src/server/auth/*`.

- [x] Database identity foundation
  - Acceptance: accounts, sessions, and login throttling persist without modifying sale-assignment records.
  - Verify: Prisma generate, migration deploy, TypeScript.
  - Files: `prisma/schema.prisma`, one new migration, auth repository.

- [x] Login, logout, and route protection
  - Acceptance: one-time owner setup, generic/throttled login, persistent HTTP-only session, logout redirect.
  - Verify: route responses and session tests.
  - Files: auth routes, login page, middleware/layout, session module.

- [x] Forced password replacement
  - Acceptance: temporary-password staff cannot enter the app until changing password; prior sessions are revoked.
  - Verify: auth policy tests and route checks.
  - Files: change-password route/page and session guards.

- [x] Account settings
  - Acceptance: signed-in users edit only their own allowed profile fields; role is read-only; image is validated.
  - Verify: validation tests and account API/UI interaction.
  - Files: account route, panel, settings workspace/styles.

- [x] Owner-only Staff settings
  - Acceptance: owner lists/creates/deactivates/reactivates/resets pharmacists; pharmacist receives 403 and sees no Staff item.
  - Verify: authorization tests and owner/pharmacist route/UI checks.
  - Files: staff route, panel, sidebar/workspace/styles.

- [x] Navigation and business-only Store Profile
  - Acceptance: logout-only profile menu; Store Profile contains only pharmacy business fields.
  - Verify: keyboard/accessibility/browser inspection where available.
  - Files: TopBar and Store Profile placeholder.

- [x] Final verification
  - Acceptance: migration applied, no plaintext credentials/secrets, all targeted tests/types/diff checks pass.
  - Verify: direct Node test/type commands, `git diff --check`, live routes, browser checks if available.

---

# React Router 7 + Vite SPA Migration

- [x] Migration contract
  - Acceptance: framework boundary, auth/security behavior, API compatibility, production serving, and rollback are explicit.
  - Verify: `tasks/react-router-vite-migration-spec.md` covers all current routes and endpoints.

- [x] Vite and React Router browser runtime
  - Acceptance: the SPA mounts through one data router, lazy routes cover all current URLs, and auth guards preserve existing redirects.
  - Verify: routing/auth tests, TypeScript, production client build.

- [x] Framework-neutral API handlers
  - Acceptance: handlers use Web `Request`/`Response`, request-scoped cookies, and unchanged payload/status contracts.
  - Verify: auth/session/API tests and route registry parity test.

- [x] Node development and production server
  - Acceptance: dev proxy uses ports 3000/3001; production serves API/assets/SPA fallback with secure headers and body limits.
  - Verify: server build and runtime smoke requests for API, asset, and nested SPA routes.

- [x] Next.js retirement
  - Acceptance: no `next/*` imports/configuration/dependency or `.next` type references remain.
  - Verify: repository search, dependency tree, TypeScript, builds.

- [x] Final migration verification
  - Acceptance: existing tests and workflows pass without database changes or unrelated worktree loss.
  - Verify: tests, TypeScript, builds, runtime smoke tests, `git diff --check`; Chrome DevTools/browser control was unavailable for desktop/tablet visual checks in this session.

---

# Set Item Detail

- [x] Contract and persistence
  - Acceptance: product detail defaults persist; pharmacists cannot change discount policy; invalid integers and min/max ranges are rejected.
  - Verify: focused validation/authorization tests, Prisma generation, TypeScript.

- [x] Compact stock dialog
  - Acceptance: pen opens Set Item Detail; row click still opens full Edit Item; owner-only controls stay visible and disabled for pharmacists.
  - Verify: component interaction/runtime check and accessibility inspection where browser tooling is available.

- [x] Tags filter
  - Acceptance: saved non-empty tags populate a searchable multi-select sidebar filter and combine with other filters.
  - Verify: stock filter unit tests.

- [x] Sales discount integration
  - Acceptance: integer item discount applies first and bill discount applies to the remaining subtotal; zero remains the default.
  - Verify: sales calculation unit tests and sale totals check.

- [x] Pill reminder defaults
  - Acceptance: four saved whole-number doses prefill the reminder; all-zero defaults leave the row unchecked.
  - Verify: reminder-default unit tests and runtime interaction check.

- [x] Final verification
  - Acceptance: no unrelated worktree changes are overwritten and all agreed behavior is represented in code and tests.
  - Verify: focused tests, direct TypeScript check, `git diff --check`, and browser verification if available.
