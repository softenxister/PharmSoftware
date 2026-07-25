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

- [x] Add evidence-result types and failing representative tests.
- [x] Implement ranked family, brand, ingredient, and strong-purpose rules.

### Checkpoint: Classifier

- [x] Focused pure tests pass, including false-positive and conflict guards.

### Phase 2: Catalog Preview

- [x] Extend the script to re-evaluate fallback products and report reasons/conflicts/samples.
- [x] Audit the complete live preview and refine only evidence-backed high-volume families.

### Checkpoint: Preview

- [x] At least 25% of fallback products move with unique high-confidence evidence.
- [x] Representative samples for every destination category are credible.

### Phase 3: Guarded Apply

- [x] Write a detailed backup and apply the reviewed assignments transactionally.
- [x] Verify live counts, category integrity, and zero changes to explicit non-fallback assignments.

### Checkpoint: Complete

- [x] Related tests, TypeScript baseline comparison, and diff checks are complete.
- [x] The implementation and final distribution are committed.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A brand spans multiple retail categories | High | Use model/use terms or mark the brand ambiguous; never map that brand alone. |
| A therapeutic ingredient conflicts with route/site | High | Route-specific evidence wins only when explicit; unresolved ties remain fallback. |
| Existing fallback hides a manual choice | Medium | This pass is explicitly authorized to re-evaluate fallback only; backup every changed ID. |
| Loose substring matching creates false positives | High | Use anchored family rules and whole normalized terms with negative regression cases. |

## Open Questions

- None. The user confirmed the classification policy before implementation.

---

# Implementation Plan: Verified Product Images

## Overview

Resolve images for the complete product catalog with an evidence-ranked, resumable pipeline. Exact
product identity is more important than image coverage: only licensed, conflict-free identifier
matches may publish automatically; every uncertain match is reviewed by an Owner; unresolved
products receive the approved brand-name placeholder.

The implementation follows `tasks/product-image-resolution-spec.md` and does not add an AI or npm
dependency. Exact GTIN matching, deterministic field comparison, and hard-conflict rejection are the
low-resource default. Text similarity may produce review candidates but can never auto-publish.

## Architecture Decisions

- Keep `Product.imageUrl` as the compatibility URL used by existing screens, but point it only to
  the internal product-image endpoint.
- Store identity, candidates, and approved asset provenance separately so the current asset can be
  changed without losing audit history.
- Start with exact-barcode Open Products Facts family adapters because they are free and document
  reusable community data; leave permissioned manufacturer/GDSN and identifier-specific DailyMed
  adapters behind the same provider interface.
- Perform all external fetches server-side through provider hostname allowlists, DNS/IP validation,
  bounded redirects, timeouts, byte limits, MIME signature checks, and image-dimension checks.
- Upload only approved bytes to a private S3 bucket with AWS Signature Version 4. Never hotlink a
  published product image and never expose credentials or signed storage URLs.
- Default every current and future product to `PENDING`; use a bounded database lease/retry state so
  jobs can resume without double-processing.
- Generate the unresolved SVG locally from the stored brand. Null, blank, or `Unspecified` renders
  as `Invalid`.

## Dependency Graph

1. Persistence contract
2. Identity, evidence, image validation, and placeholder rules
3. Provider discovery and secure remote fetch
4. S3 storage and image delivery
5. Resolver repository/orchestrator
6. Owner APIs and review UI
7. Catalog backfill and operational verification

Tasks 2 and 3 depend on Task 1 contracts. Task 4 depends on validated image bytes from Task 3. Task
5 composes Tasks 1–4. Task 6 depends on Task 5. Task 7 starts only after all safeguards and review
controls are verified.

## Task List

### Phase 1: Persistence and Pure Contracts

- [x] Add image-resolution enums, product state, identifiers, candidates, assets, indexes, and an
  additive migration that marks all existing products `PENDING`.
  - Files: `prisma/schema.prisma`, one new migration, generated Prisma client.
  - Acceptance: existing product/sale relations remain intact; new products default to `PENDING`;
    candidate uniqueness and one-current-asset-per-product are enforced by the database.
  - Verify: schema validation/generation, migration SQL inspection, focused repository contract test.
- [x] Implement and test GTIN normalization, hard-field evidence comparison, score bands, source
  licensing rules, safe brand fallback, XML escaping, and deterministic unresolved SVG rendering.
  - Files: focused modules and colocated tests under `src/server/product-images/`.
  - Acceptance: bad check digits never become exact matches; every hard conflict rejects; text-only
    candidates never auto-publish; placeholder output is safe and matches the approved design.
  - Verify: red-green focused Node tests including Thai/English, long text, malicious XML, blank,
    and `Unspecified` brands.

### Checkpoint: Foundation

- [x] Prisma generation and focused pure tests pass.
- [x] A migration dry run shows no product deletion and exactly the current catalog marked pending.

### Phase 2: Secure Discovery and Storage

- [x] Implement the provider interface, exact-barcode Open Products Facts adapter, bounded cache,
  rate limiting, and safe unresolved behavior where no valid identifier exists.
  - Files: provider modules and tests under `src/server/product-images/providers/`.
  - Acceptance: queries use only normalized valid identifiers where available; provider responses
    retain source page, image URL, licence, and evidence; failures become bounded retry state.
  - Verify: fixture-driven tests without live network dependence, plus one explicit provider smoke
    test when network access is available.
- [x] Implement the secure image fetcher and decoder-level metadata validation.
  - Files: fetch/security modules and tests under `src/server/product-images/`.
  - Acceptance: HTTPS and allowlists are mandatory; unsafe DNS targets, cross-host redirects,
    oversized content, HTML/SVG, MIME spoofing, tiny images, and timeouts are rejected.
  - Verify: local fixture server tests cover redirect, byte-limit, magic-byte, dimensions, and SSRF
    rejection paths.
- [x] Implement private S3 SigV4 put/get support and checksum-addressed object keys.
  - Files: S3/storage module, configuration validator, and tests.
  - Acceptance: credentials remain server-only; no ACL is sent; object keys are deterministic;
    missing configuration blocks approval without corrupting candidate state.
  - Verify: canonical-request/signature fixtures and an optional configured-bucket smoke test.

### Phase 3: Resolver and APIs

- [x] Implement the database repository and resumable resolver orchestrator.
  - Files: repository/orchestrator modules and focused tests.
  - Acceptance: exact, conflict-free, licensed candidates may auto-publish; all other plausible
    candidates enter review; rejected/unresolved products stay unverified; retries are idempotent.
  - Verify: transaction/state-machine tests cover duplicate runs, stale decisions, provider failure,
    auto-approval, manual review, and checksum deduplication.
- [x] Add authenticated product-image serving and Owner-only candidate preview/review/job endpoints,
  then register every route.
  - Files: scoped API routes, `server/apiRegistry.ts`, `server/apiRegistry.test.ts`.
  - Acceptance: image serving returns S3 bytes or the safe placeholder; review mutations call
    `requireStoreOwner`; stale mutations return `409`; arbitrary URLs cannot enter the proxy.
  - Verify: route/authorization/cache/content-security tests and route registry parity.

### Checkpoint: Backend

- [x] Focused resolver, security, S3, API, and registry tests pass.
- [x] Unconfigured S3 produces a safe, actionable Owner error while discovery remains resumable.

### Phase 4: Permanent Owner Review Screen

- [x] Add **Settings → Product Image Review** for Owners only.
  - Files: a focused review panel/client, `SettingsSidebar.tsx`, `SettingsWorkspace.tsx`,
    `Settings.module.css`, and relevant i18n/tests.
  - Acceptance: stable desktop/tablet summary and comparison layout; search/filter/pagination;
    evidence, licence, and dimensions are visible; Approve/Reject/Leave unresolved are guarded;
    pharmacists neither see nor access the feature.
  - Verify: component/state tests, keyboard/accessibility inspection, long-value layout checks, and
    console/network checks in the isolated browser.

### Checkpoint: Review Workflow

- [x] Owner and pharmacist authorization is verified at both UI and API layers.
- [x] Desktop and tablet visual states pass with no layout shift or browser console warnings.

### Phase 5: Complete-Catalog Backfill

- [ ] Add a resumable direct-Node CLI and enqueue all current products without changing stock,
  prices, sales, purchases, or product identity.
  - Files: `scripts/resolve-product-images.ts` plus focused CLI option tests.
  - Acceptance: dry run reports total/pending/review/unresolved/verified counts; bounded apply visits
    every current product; interruption and restart continue from persisted state.
  - Verify: catalog counts before/after, per-status totals summing to the product total, failure
    samples, duplicate checks, and a recovery snapshot of every prior `imageUrl`.
- [ ] Configure the private S3 bucket and run the publication pass only after valid credentials are
  supplied and the bucket safety check passes.
  - Acceptance: Block Public Access and bucket-owner-enforced behavior are confirmed; no secrets are
    logged; approved assets load only through the authenticated internal route.
  - Verify: upload/read smoke test, checksum match, cache headers, and direct-public-access denial.

### Checkpoint: Complete

- [ ] Focused and existing regression tests, TypeScript, Prisma, and `git diff --check` pass without
  npm commands.
- [ ] Every current product has a terminal or actionable state: `VERIFIED`, `REVIEW`, or
  `UNRESOLVED`; every future product defaults to `PENDING`.
- [ ] Browser verification covers desktop and tablet Owner review plus normal stock/sales image
  rendering.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A similar package is assigned to the wrong medicine | Critical | Auto-publish requires exact valid identifier and zero hard conflicts; text-only matches require Owner review. |
| A provider disallows reuse or changes terms | High | Provider-level licence gate, retained attribution, and immediate adapter disable without deleting audit history. |
| External image fetch enables SSRF or memory exhaustion | Critical | Fixed provider allowlists, DNS/IP checks, redirect policy, timeout, streaming byte cap, magic-byte and dimension validation. |
| S3 credentials or objects become public | Critical | Server-only configuration, private bucket checks, no ACLs/signed URLs in responses, internal authenticated delivery. |
| A 12k-product run is interrupted or rate-limited | High | Small resumable batches, persisted retry timestamps, provider cache, idempotent candidate uniqueness. |
| Free sources do not cover Thai products | Medium | Preserve unresolved state, prioritize future authorized Thai distributor/manufacturer feeds, and never lower identity standards for coverage. |
| Existing product image consumers break | High | Preserve `imageUrl` compatibility and regression-test stock, sales, and purchase mappings. |
| AWS free-tier eligibility or credits expire | Medium | Add batch/storage visibility and stop publication when configuration or cost guardrails are absent. |

## Required External Input

- S3 publication requires the bucket name, region, and least-privilege server credentials. Discovery,
  review queue creation, placeholders, and all non-storage tests can be completed before those
  secrets are supplied.

## Open Questions

- None for implementation. The interview restatement and product-image specification were explicitly
  approved. S3 credentials are a deployment input, not a design choice.
