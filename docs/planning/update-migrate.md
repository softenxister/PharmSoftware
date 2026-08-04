# Implementation Plan: CW Stock Full Import and Focused G/I Update

## Overview

Keep one CW stock-file upload area, but require the owner to choose one of two explicit modes before previewing:

1. **Full stock import** for the initial migration. It creates or fully refreshes products, packaging, barcodes, selling prices, and stock, and it also stores columns G and I.
2. **Update generic name & latest cost** for later refreshes. It matches only column C (`รหัสสินค้า`) and writes only column G (`ชื่อสามัญ`) and column I (`ราคาทุนรับหลังสุด`). It never creates products and never changes names, barcodes, packaging, prices, stock, category, manufacturer, active status, or verified ingredient records.

The two modes are primarily a data-safety boundary. A G/I update will also perform fewer database writes than a full import, but the CSV upload and parsing time will be similar because the same file is uploaded.

## Architecture Decisions

- Add `Product.migrationGenericName String?` for the raw CW value from column G. Do not write this unverified source text into `ProductIngredient`, which currently represents normalized, source-backed active ingredients used by composition and allergy features.
- Continue storing column I in `Product.migrationCostThb`. Both fields are interpreted per product base unit.
- Represent the operation explicitly as `mode: "full" | "generic-cost-update"` across UI, client, API, preview token, and repository boundaries. Never infer the mode from whether a product already exists.
- Reuse one file picker and one review flow. Present two clearly labeled mode choices/buttons rather than two separate upload widgets.
- In focused update mode, match by exact normalized CW product code only. Do not fall back to barcode, name, or internal ID, and do not create a product when the code is missing.
- In focused update mode, blank G or blank/zero I means **leave that existing field unchanged**. This prevents incomplete export rows from erasing existing data. Clearing a value should be a separate explicit operation if needed later.
- Bind the selected mode, file bytes, matched product IDs, and proposed G/I values into the confirmation token so a preview cannot be reused for a different write scope.
- Record a lightweight metadata-import run separately from `StockAdjustment`; a G/I update does not change stock and must not appear as an inventory movement.

## Expected Behavior

| Behavior | Full stock import | G/I update |
|---|---|---|
| Match column | Product code first, current barcode reconciliation retained | Exact product code only |
| Create missing products | Yes | No |
| Column G: `ชื่อสามัญ` | Store in `migrationGenericName` | Update when nonblank |
| Column I: `ราคาทุนรับหลังสุด` | Store in `migrationCostThb` | Update when greater than zero |
| Item name / barcode | Import | Ignore completely |
| Units / selling prices | Import | Ignore completely |
| Stock quantity | Replace and audit | Never touch |
| Category / manufacturer / active status | Import | Ignore completely |
| Verified `ProductIngredient` rows | Existing full-import identity rules remain | Never touch |
| Unmatched product code | Create or reconcile in full flow | Report as unmatched and skip |

## Task List

### Task 1: Persist the raw CW generic name

**Description:** Add a nullable Product field for the exact column-G text and a safe database migration. Extend the existing full-import write so both G and I are stored for newly created and fully refreshed products.

**Acceptance criteria:**

- `ชื่อสามัญ` is preserved exactly after trimming outer whitespace in `Product.migrationGenericName`.
- `ราคาทุนรับหลังสุด` continues to populate `Product.migrationCostThb`.
- Blank generic names and non-positive costs become `NULL` on full import.

**Verification:**

- Schema/migration tests assert both columns and constraints.
- Repository tests prove full-import inserts and updates both fields.
- Generated Prisma client is refreshed during implementation.

**Dependencies:** None

**Files likely touched:**

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_product_migration_generic_name/migration.sql`
- `server/db/migration/cwStockMigrationRepository.ts`
- `server/db/migration/cwStockMigrationRepository.test.ts`

**Estimated scope:** Medium

### Task 2: Build a focused C/G/I parser and preview model

**Description:** Add a pure update-mode parser that accepts the normal full CW CSV but reads only product-code, generic-name, and latest-cost columns. Packaging continuation rows and every unrelated column are ignored.

**Acceptance criteria:**

- Required headers are `รหัสสินค้า`, `ชื่อสามัญ`, and `ราคาทุนรับหลังสุด`; extra columns are accepted.
- Bad or changed item names/barcodes do not block or affect an update preview.
- Duplicate nonblank product codes, invalid positive costs, and missing codes are reported deterministically.
- Preview rows show matched item, current G/I, proposed G/I, and status: changed, unchanged, unmatched, or invalid.

**Verification:**

- Parser tests cover a full CW file, a three-column file, packaging continuation rows, duplicate codes, blank cells, zero cost, and invalid cost.
- Matching tests prove that barcode/name differences are ignored and exact code is required.

**Dependencies:** Task 1

**Files likely touched:**

- `server/import/cwStockDetailUpdate.ts`
- `server/import/cwStockDetailUpdate.test.ts`
- `server/import/cwStockUpload.ts`

**Estimated scope:** Medium

### Checkpoint: Storage and reconciliation contract

- Confirm raw CW generic name is separate from verified active ingredients.
- Confirm focused mode cannot match by barcode or create products.
- Confirm blank update cells preserve existing values.

### Task 3: Implement the isolated G/I database update

**Description:** Add a repository operation that re-previews inside a transaction, verifies the token, then batch-updates only `migrationGenericName` and `migrationCostThb` for exact code matches.

**Acceptance criteria:**

- The generated SQL/update data contains only the two allowed Product fields plus `updatedAt`.
- No ProductBatch, ProductParentPack, ProductBarcodeAlias, StockAdjustment, ProductIngredient, category, or manufacturer writes occur.
- Changed, unchanged, unmatched, and invalid counts are returned, and an import-run audit record captures mode, file hash/name, actor, timestamp, and counts.

**Verification:**

- Repository tests assert the update write shape and exact-code targeting.
- A regression test snapshots protected fields before and after the update and proves they are identical.
- Transaction/token tests prove changed files or changed database reconciliation require a new preview.

**Dependencies:** Tasks 1 and 2

**Files likely touched:**

- `server/db/migration/cwStockDetailUpdateRepository.ts`
- `server/db/migration/cwStockDetailUpdateRepository.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_product_import_run/migration.sql`

**Estimated scope:** Medium

### Task 4: Make import mode explicit in the API contract

**Description:** Carry the chosen mode from browser to server for both preview and import, route each mode to its own reconciliation and repository function, and include the mode in confirmation validation.

**Acceptance criteria:**

- Requests without a recognized mode are rejected.
- A full-mode preview token cannot execute a G/I update, and the reverse is also rejected.
- Response types expose mode-specific summaries without weakening runtime validation.

**Verification:**

- Route tests cover both modes, invalid mode, token mismatch, permission checks, and safe error responses.
- Client contract tests verify the mode is submitted on preview and import.

**Dependencies:** Tasks 2 and 3

**Files likely touched:**

- `server/routes/stockMigrations/cwStock.ts`
- `src/features/stock/migration/migrationClient.ts`
- Related route/client tests

**Estimated scope:** Medium

### Checkpoint: End-to-end write safety

- Full import still behaves as before and now persists G and I.
- G/I update changes only the two intended fields.
- Re-preview protection and owner authorization work for both modes.

### Task 5: Add the two-mode Stock items UI

**Description:** Keep one Stock items upload card, add a compact choice between “Full stock import” and “Update generic name & latest cost,” then render mode-specific preview and confirmation copy.

**Acceptance criteria:**

- The owner chooses a mode before preview; changing mode clears any old preview/confirmation.
- The focused preview displays product code and old → new G/I values, plus changed/unchanged/unmatched/invalid totals.
- Full confirmation warns that product/stock data can be replaced; focused confirmation explicitly promises that item names, barcodes, prices, units, and stock are untouched.
- Recognized headers include `ชื่อสามัญ` and `ราคาทุนรับหลังสุด`.

**Verification:**

- Component behavior tests cover mode changes, disabled states, preview, confirmation, and result messages.
- Manually verify dense desktop/tablet layout and accessible labels using an available browser method; do not claim visual verification if none is available.

**Dependencies:** Task 4

**Files likely touched:**

- `src/pages/stock/StockMigrationPage.tsx`
- `src/features/stock/migration/MigrationPreviewPanel.tsx`
- `src/features/stock/migration/StockDetailUpdatePreviewPanel.tsx`
- `src/features/stock/migration/StockMigration.module.css`

**Estimated scope:** Medium

### Task 6: Regression verification and operator documentation

**Description:** Verify both workflows against representative CW files and document when each mode should be used.

**Acceptance criteria:**

- Initial/full import creates a new product with identity, packaging, stock, generic name, and latest cost.
- Re-upload in focused mode updates G/I by product code while every protected field remains unchanged.
- Unmatched codes are visible and skipped, and repeated focused import with unchanged values is idempotent.
- Operator documentation clearly says the two modes are for write scope and safety, not primarily for upload speed.

**Verification:**

- Targeted import, repository, route, and component tests pass.
- `git diff --check` passes.
- Run project-wide npm test/build commands only when explicitly authorized under repository rules.

**Dependencies:** Task 5

**Files likely touched:**

- `docs/data/cw-stock-normalization.md`
- Existing CW migration test files

**Estimated scope:** Small

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Update mode accidentally uses the full importer | High | Separate mode-specific parser/repository functions and assert protected fields in tests |
| Raw generic text is mistaken for verified allergy data | High | Store it in `migrationGenericName`, never directly in `ProductIngredient` |
| Blank cells erase useful values | Medium | Treat blank G and blank/zero I as no change in focused mode |
| Wrong product receives an update | High | Exact unique `externalProductCode` matching only; unmatched rows are skipped |
| Stale preview writes different data | High | Token includes mode, file hash, target IDs, and proposed values; re-preview inside transaction |
| Full import is used accidentally after manual curation | High | Explicit mode choice and destructive-scope confirmation wording |
| Users expect a major upload-speed improvement | Low | Explain that focused mode mainly reduces DB work and protects data; file transfer/parsing remains similar |

## Recommended UI Decision

Use **one uploader with two explicit mode buttons/choices**, not one ambiguous Import button and not two duplicate upload sections:

- `Full stock import` — initial setup or intentional full replacement
- `Update generic name & latest cost` — recurring C/G/I refresh

Do not auto-select behavior based on whether products already exist. That would make the same file produce a different write scope without a clear operator decision.
