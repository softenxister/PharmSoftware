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

---

# Member Data Migration

- [x] Member CSV contract
  - Acceptance: UTF-8 CSV rows parse safely; required data, dates, phone normalization, and conflicts match the confirmed rules.
  - Verify: focused tests fail before implementation and pass afterward.
  - Files: `src/server/import/memberDataMigration.ts`, upload module, colocated tests.

- [x] Transactional member import API
  - Acceptance: owner-only preview/import rechecks the confirmation token, upserts valid rows by member code, preserves internal fields, and skips blocked rows.
  - Verify: repository tests where pure, API registry test, Prisma validation, TypeScript.
  - Files: member migration repository, API route, server registry, Prisma migration.

- [x] Member migration UI
  - Acceptance: the page accepts a CSV, previews exact source phone values and row status, confirms import, and reports created/updated/blocked totals.
  - Verify: type check and browser interaction at desktop/tablet widths where tooling is available.
  - Files: migration client, member card/preview components, migration page, scoped styles.

- [x] Final verification
  - Acceptance: no npm commands or unrelated edits; all agreed behavior is tested and import controls are guarded while invalid or busy.
  - Verify: focused direct Node tests, installed TypeScript/Prisma binaries, builds, and `git diff --check` passed; the approved stock-index/member migrations were applied and the live member count is zero. Browser tooling is unavailable.

---

# Distributor Data Migration

- [x] XLSX/CSV distributor contract
  - Acceptance: bounded parsers discover `รหัส` and `ชื่อ`, ignore every other field, and reconcile by code then exact name.
  - Verify: focused parser/upload tests fail before implementation and pass afterward using a real minimal XLSX fixture.

- [x] Transactional distributor import API
  - Acceptance: owner-only preview/import adds or updates code/name while preserving phone, email, and purchase history.
  - Verify: repository tests, API registry test, Prisma validation, and TypeScript.

- [x] Distributor migration UI
  - Acceptance: `/stock/migration` accepts XLSX/CSV, previews rows, guards confirmation, and reports created/updated/blocked totals.
  - Verify: production client build and browser checks where tooling is available.

- [x] Final verification and additive deployment
  - Acceptance: the distributor-code migration is applied without deleting or rewriting existing distributor data.
  - Verify: focused tests, schema/client checks, builds, `git diff --check`, and live read-only schema verification.

---

# Evidence-Ranked Product Category Coverage

- [x] Evidence-producing classifier
  - Acceptance: family, brand, ingredient, and strong-purpose matches return one category, confidence, and reason; conflicts remain fallback.
  - Verify: failing-then-passing pure tests with false-positive guards.
  - Files: `src/server/import/productCategoryNormalization.ts` and its test.

- [x] Complete-catalog preview
  - Acceptance: fallback products are re-evaluated while explicit categories stay fixed; output includes counts, reasons, conflicts, and samples.
  - Verify: preview against the live 12,163-product catalog.
  - Files: `scripts/normalize-product-categories.ts`.

- [x] Guarded live apply
  - Acceptance: at least 25% of the 8,851 fallback products move on unique high-confidence evidence with a detailed backup.
  - Verify: live count comparison, category integrity query, and representative sample audit.
  - Files: normalization backup output only; no schema change.

- [x] Final verification
  - Acceptance: focused tests and diff checks pass, TypeScript adds no new errors, and changes are committed without the backup artifact.
  - Verify: direct Node/TypeScript/git commands; no npm commands.
