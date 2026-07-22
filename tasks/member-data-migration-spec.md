# Spec: Member Data Migration

## Objective

Add an owner-only “Member data” CSV workflow to `/stock/migration` so pharmacy staff can preview and import the real member list safely. The workflow must create new members, update existing members by member code, skip blocked rows, and report the result without importing unrelated CW fields.

## Tech Stack

- React 19 and React Router 7 for the migration page.
- Standard Web `Request`, `Response`, `FormData`, and `File` APIs for upload handling.
- TypeScript import/validation modules and Node's test runner.
- Prisma 7 with PostgreSQL for transactional member upserts.

## Commands

- Focused tests: `node --env-file-if-exists=.env --import tsx --test src/server/import/memberDataMigration.test.ts src/server/import/memberDataUpload.test.ts`
- API registry test: `node --env-file-if-exists=.env --import tsx --test server/apiRegistry.test.ts`
- Type check: `node_modules/.bin/tsc --noEmit`
- Prisma validation: `node_modules/.bin/prisma validate`
- Diff check: `git diff --check`

The project instruction forbids npm commands unless explicitly requested, so verification uses installed binaries directly.

## Project Structure

- `src/server/import/` parses UTF-8 CSV data, normalizes import values, classifies rows, and creates confirmation tokens.
- `src/server/db/` rechecks the preview and performs transactional member upserts.
- `src/app/api/stock/migrations/members/` exposes the owner-only preview/import endpoint.
- `src/app/stock/migration/` contains the upload, preview, confirmation, and result UI.
- `prisma/migrations/` contains the one-time dummy-member cleanup alongside the new member fields.

## Code Style

Use explicit discriminated status values and boundary validation:

```ts
type MemberMigrationStatus = "new" | "update" | "conflict";

if (!memberCode || !name || !membershipStartedAt) {
  return { status: "conflict", issue: "Required member data is missing." };
}
```

Keep pure CSV/domain logic separate from database writes. Preserve exact CSV phone text in the preview while carrying server-only normalized, comma-separated phone values into the confirmed import.

## Testing Strategy

- Unit tests prove UTF-8 validation, quoted CSV parsing, required headers, date validation, phone normalization, invalid-phone-to-null behavior, member-code matching, and allowed phone reuse.
- Contract tests prove the new API route is registered exactly once.
- Type checking and Prisma validation prove repository/schema compatibility.
- Browser verification checks desktop and tablet layout, upload/preview interaction, accessibility structure, network responses, and a clean console when browser tooling is available.

## Boundaries

- Always: require owner authorization, validate at the upload/API boundary, re-evaluate conflicts inside the import transaction, and import only non-blocked rows.
- Ask first: changes to the confirmed column mapping or destructive cleanup beyond the approved one-time dummy-member deletion.
- Never: import `ลำดับ`, `Active`, `บาร์โค้ด`, `คะแนนขายปลีก`, or `คะแนนขายส่ง`; overwrite internal points/rank on updates; silently replace invalid membership dates; delete members during normal future imports.

## Success Criteria

- A UTF-8 CSV can be uploaded and previewed before any database write.
- Preview shows the exact original phone value and classifies every row as new, update, or blocked.
- Blank member code/name or invalid `DD/MM/YYYY` membership date blocks that row.
- Each comma-separated phone is normalized independently: eight-digit Bangkok and nine-digit mobile phones gain a leading zero, and `66…` phones become Thai `0…`. If any phone is invalid, the phone field imports as `NULL`.
- Valid normalized phone numbers may repeat within the upload or across existing customers/members; Preview shows a non-blocking warning for each affected row, and member code remains the only import identity.
- Confirmation imports valid rows only, upserting by member code and reporting created, updated, blocked, and total imported counts.
- Existing points, membership rank, avatar, allergies, and purchase history remain unchanged when a member is updated.
- The current dummy members are deleted once by migration; later member imports never replace the full member list.

## Open Questions

None. The user explicitly confirmed the interview restatement and requested implementation.
