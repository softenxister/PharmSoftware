# Spec: Distributor Data Migration

## Objective

Add an owner-only distributor workflow to `/stock/migration` that accepts the original CW `Spl_Items.xlsx` export or an equivalent UTF-8 CSV, previews `รหัส` and `ชื่อ`, and imports only those two values. Address, phone, email, fax, contact, and purchase-history columns are deliberately ignored.

## Tech Stack

- React 19 and React Router 7 for the migration page.
- Web `Request`, `FormData`, and `File` APIs for uploads.
- TypeScript with Node built-ins for bounded XLSX OOXML/ZIP and UTF-8 CSV parsing; no new dependency.
- Prisma 7 with PostgreSQL for additive distributor-code persistence and transactional imports.

## Commands

- Focused tests: `node --env-file-if-exists=.env --import tsx --test server/import/distributorDataMigration.test.ts server/import/distributorDataUpload.test.ts server/db/distributorDataMigrationRepository.test.ts server/apiRegistry.test.ts`
- Type check: `node_modules/.bin/tsc --noEmit --incremental false`
- Prisma validation: `node_modules/.bin/prisma validate`
- Client build: `node_modules/.bin/vite build`
- Diff check: `git diff --check`

Project rules prohibit npm commands unless explicitly requested, so installed binaries are used directly.

## Project Structure

- `server/import/` validates files, extracts XLSX/CSV rows, and reconciles distributor identities.
- `server/db/` rechecks preview state and performs transactional creates/updates.
- `src/app/api/stock/migrations/distributors/` exposes the owner-only preview/import endpoint.
- `src/app/stock/migration/` contains the upload card and dense preview table.
- `prisma/migrations/` adds the optional unique CW distributor code.

## Code Style

Keep the source mapping explicit and narrow:

```ts
type DistributorSourceRow = {
  rowNumber: number;
  code: string; // รหัส
  name: string; // ชื่อ
};
```

No unrecognized workbook field may enter a database write object.

## Testing Strategy

- Unit tests use a minimal real XLSX fixture to prove header discovery, inline strings, ignored address/contact cells, UTF-8 CSV parity, size/type limits, matching, conflicts, and confirmation tokens.
- Repository tests prove updates preserve phone, email, and purchase relations.
- API registry, Prisma, TypeScript, production build, and diff checks cover integration boundaries.
- Browser verification covers desktop/tablet upload, preview, confirmation, accessibility, network, and console behavior when Chrome DevTools is available.

## Boundaries

- Always: owner authorization, 5 MB limit, preview before import, transaction-time reconciliation, row-level validation, and valid-row import when other rows are blocked.
- Ask first: destructive distributor cleanup, purchase-history reassignment, or importing fields beyond `รหัส` and `ชื่อ`.
- Never: execute workbook formulas/macros, import address/contact details, delete distributors, or overwrite phone/email/purchase history.

## Success Criteria

- Original `Spl_Items.xlsx` uploads directly; UTF-8 CSV with discoverable `รหัส` and `ชื่อ` headers is also accepted.
- Preview shows source row, code, name, status, and any blocking reason before writes.
- Existing code match updates the name; otherwise exact trimmed name match attaches the code; otherwise a new distributor is created.
- Duplicate/missing code or name and ambiguous code/name matches block only affected rows.
- Import preserves all distributor fields and purchase relations except the requested code/name update.
- No new spreadsheet parsing dependency is added.

## Open Questions

None. XLSX is the preferred staff workflow; CSV remains supported for compatibility.
