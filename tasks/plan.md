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

---

# Implementation Plan: Set Item Detail

## Overview

Add a compact, persisted Set Item Detail workflow to `/stock` while preserving the existing full item editor on row click. The pen action opens the compact dialog; saved stock thresholds, tag, returnability, dosage defaults, and item discount policy flow through the stock catalog into filtering and `/sales/new`.

## Architecture Decisions

- Extend `Product` with additive fields and safe database defaults: minimum 20, maximum 200, discount 0, unlocked, returnable, four zero dosage values, and one optional tag.
- Use `PATCH /api/stock` for partial detail updates. Any authenticated pharmacist may update operational fields; only owners may change discount percentage or discount locking.
- Keep the existing full edit window on stock-row activation. Only the pen action changes to Set Item Detail.
- Apply item discounts before the existing bill discount. An all-zero dosage means the pill-reminder row starts unchecked.

## Task List

### Phase 1: Contract and Persistence

- [x] Add failing validation, authorization, filter, discount, and dosage tests.
- [x] Add the product fields, migration defaults, catalog mapping, and authorized stock detail update endpoint.

### Checkpoint: Foundation

- [x] Focused contract and repository-adjacent tests pass.
- [x] Generated Prisma client and TypeScript contracts are current.

### Phase 2: Stock Workflow

- [x] Build the accessible Set Item Detail dialog using the Stock Adjustment visual shell.
- [x] Preserve row-click full editing and route only the pen action to the compact dialog.
- [x] Add the searchable multi-select Tags filter to the left stock sidebar.

### Phase 3: Sales Integration

- [x] Apply item discounts before bill discount and preserve locked item discount policy.
- [x] Prefill Pill Reminder from the four saved dosage values; all-zero defaults start unchecked.

### Checkpoint: Complete

- [x] Focused tests, TypeScript, generated client, production builds, and `git diff --check` pass.
- [ ] Desktop/tablet dialog and interactions are visually verified (browser tooling unavailable in this session).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Pharmacist tampers with owner-only discount fields | High | Enforce field-level authorization on the server, not only disabled controls. |
| Item and bill discounts produce incorrect totals | High | Isolate sequential discount math in tested pure functions and use the same values for submit totals. |
| Existing products keep calculated placeholder thresholds | Medium | Backfill the migration explicitly to 20/200 and map stored values everywhere. |
| Compact dialog destabilizes the dense stock table | Medium | Reuse the adjustment shell, fixed control heights, min-width safeguards, and tablet wrapping. |

## Open Questions

- None. The user approved each behavior during the grilling session and explicitly requested implementation.

---

# Implementation Plan: Member Data Migration

## Overview

Add an owner-only UTF-8 member CSV workflow to `/stock/migration`, preserving the stock importer while adding row-level preview, validation, conflict blocking, and idempotent upserts by member code.

## Architecture Decisions

- Keep CSV parsing and reconciliation pure; the repository reads existing identities and re-runs reconciliation inside a serializable transaction.
- Use member code as the only update key. Phone may repeat and is never an automatic merge key.
- Preserve raw phone text in preview and normalize only the stored value; invalid phone formats become null without blocking the member.
- Keep the destructive cleanup one-time in the additive member-field migration, never in the import endpoint.

## Task List

### Phase 1: Import Contract

- [x] Add failing parser, normalization, reconciliation, and UTF-8 upload tests.
- [x] Implement the pure member migration contract and make focused tests pass.

### Checkpoint: Contract

- [x] Required fields, phone rules, duplicate handling, and confirmation tokens pass focused tests.

### Phase 2: Persistence and API

- [x] Add transactional member upserts that skip blocked rows and preserve internal member state.
- [x] Register the owner-only member migration endpoint and verify its API contract.
- [x] Add the approved one-time dummy-member deletion to the member-field migration.

### Phase 3: Migration UI

- [x] Enable the Member data card with upload, raw-value preview, confirmation, and result states.
- [ ] Verify dense desktop/tablet layout, accessibility, interactions, network behavior, and console output where browser tooling is available.

### Checkpoint: Complete

- [x] Focused tests, Prisma validation, TypeScript, API registry, production builds, and diff checks pass.
- [x] Every confirmed import behavior is represented in code and tests.

### Deployment Note

- [x] Apply the approved stock-index and member migrations to Neon; verify the member columns and indexes exist and the live member count is zero.
- [ ] Visually verify desktop/tablet behavior when Chrome DevTools MCP is available.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A member code appears between preview and confirmation | High | Re-read member-code identities and regenerate the reconciliation token inside a serializable transaction. |
| A partial CSV deletes legitimate members | High | Keep deletion only in the one-time schema migration; normal imports only upsert present rows. |
| Spreadsheet phone formatting loses leading zeroes | High | Normalize 8-digit Bangkok, 9-digit mobile, and `66` forms only on import while previewing exact source text. |
| Long names or addresses destabilize the table | Medium | Use bounded columns, `min-width: 0`, wrapping/truncation, and a horizontally scrollable table. |

## Open Questions

- None. The interview intent was explicitly confirmed before implementation.

---

# Implementation Plan: Distributor Data Migration

## Overview

Add the third owner-only CW dataset to `/stock/migration`, accepting the original distributor XLSX export or equivalent UTF-8 CSV and importing only distributor code/name.

## Architecture Decisions

- Prefer original XLSX in the UI while accepting CSV; both normalize into one pure `DistributorSourceRow` contract.
- Parse bounded OOXML/ZIP data with Node built-ins so deployment needs no new package; formulas and macros are never evaluated.
- Reconcile by code first, then exact trimmed name, preserving every unrelated distributor field and purchase relationship.
- Keep preview/import confirmation state-sensitive and re-run reconciliation inside a serializable transaction.

## Task List

### Phase 1: Source Contract

- [x] Add failing XLSX/CSV extraction, upload-boundary, validation, and reconciliation tests.
- [x] Implement the bounded source parser and make contract tests pass.

### Checkpoint: Source Contract

- [x] The supplied workbook yields 471 code/name records and ignores column G details.

### Phase 2: Persistence and API

- [x] Add optional unique distributor code and its additive migration.
- [x] Implement transaction-time reconciliation, bulk writes, owner-only endpoint, and API registry entry.

### Phase 3: Migration UI

- [x] Replace Distributor “Coming soon” with XLSX/CSV upload, preview, confirmation, and result states.
- [ ] Verify dense desktop/tablet behavior when browser tooling is available (Chrome DevTools/browser control unavailable in this session).

### Checkpoint: Complete

- [x] Focused tests, Prisma validation/client generation, TypeScript, builds, and diff checks pass.
- [x] Apply the additive live schema migration and verify code exists without distributor deletion.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Malformed or hostile XLSX consumes excessive memory | High | Enforce compressed upload, entry, total-expanded-size, and supported-compression limits. |
| Existing name and code point to different distributors | High | Block that row and show the ambiguity in Preview. |
| Import overwrites operational distributor details | High | Build writes from code/name only and regression-test preservation. |
| Manual CSV conversion corrupts Thai text or codes | Medium | Prefer direct original XLSX and require strict UTF-8 for CSV. |

## Open Questions

- None. The supplied CW workbook establishes the source layout and the user restricted mapping to `รหัส` and `ชื่อ`.

---

# Implementation Plan: Evidence-Ranked Product Category Coverage

## Overview

Replace the first-match-only fallback pass with auditable evidence ranking, then use it to reduce the live fallback category without overriding manual categories or guessing ambiguous products.

## Architecture Decisions

- Define Product Category as the primary broad retail-use group; keep regulatory status separate.
- Rank anchored product families, exact retail brands, generic ingredients, and strong use/form phrases.
- Require one unique high-confidence winner for bulk reassignment and retain conflicts in the fallback category.
- Re-evaluate only fallback products during bulk normalization; preserve all explicit non-fallback categories.
- Extend the existing preview/apply script with reasons, confidence, conflicts, and a reversible backup.

## Task List

### Phase 1: Classification Contract

- [ ] Add evidence-result types and failing representative tests.
- [ ] Implement ranked family, brand, ingredient, and strong-purpose rules.

### Checkpoint: Classifier

- [ ] Focused pure tests pass, including false-positive and conflict guards.

### Phase 2: Catalog Preview

- [ ] Extend the script to re-evaluate fallback products and report reasons/conflicts/samples.
- [ ] Audit the complete live preview and refine only evidence-backed high-volume families.

### Checkpoint: Preview

- [ ] At least 25% of fallback products move with unique high-confidence evidence.
- [ ] Representative samples for every destination category are credible.

### Phase 3: Guarded Apply

- [ ] Write a detailed backup and apply the reviewed assignments transactionally.
- [ ] Verify live counts, category integrity, and zero changes to explicit non-fallback assignments.

### Checkpoint: Complete

- [ ] Related tests, TypeScript baseline comparison, and diff checks are complete.
- [ ] The implementation and final distribution are committed.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A brand spans multiple retail categories | High | Use model/use terms or mark the brand ambiguous; never map that brand alone. |
| A therapeutic ingredient conflicts with route/site | High | Route-specific evidence wins only when explicit; unresolved ties remain fallback. |
| Existing fallback hides a manual choice | Medium | This pass is explicitly authorized to re-evaluate fallback only; backup every changed ID. |
| Loose substring matching creates false positives | High | Use anchored family rules and whole normalized terms with negative regression cases. |

## Open Questions

- None. The user confirmed the classification policy before implementation.
