# Spec: Evidence-Ranked Product Category Coverage

## Objective

Reduce “Other Medicines & Health Products” from the current 8,851 active products by assigning each clearly identifiable product to one of the other 17 broad retail-use categories. Category values remain language-neutral canonical records; the UI continues to select Thai or English labels independently.

## Tech Stack

- TypeScript pure classification logic in `src/server/import/`.
- Prisma 7.8 and PostgreSQL for previewing and applying category assignments.
- Existing 18-category catalog in `src/lib/productCategories.ts`.
- Existing JSON backup directory for reversible live updates.

## Commands

- Targeted tests: `node --env-file-if-exists=.env --import tsx --test src/server/import/productCategoryNormalization.test.ts`
- Related tests: `node --env-file-if-exists=.env --import tsx --test src/server/import/productCategoryNormalization.test.ts src/server/import/cwStockNormalizer.test.ts src/server/import/cwStockMigration.test.ts src/app/stock/stockCategoryFilter.test.ts`
- Preview: `node --env-file-if-exists=.env --import tsx scripts/normalize-product-categories.ts`
- Apply after review: `node --env-file-if-exists=.env --import tsx scripts/normalize-product-categories.ts --apply`
- Type check: `./node_modules/.bin/tsc --noEmit --incremental false`
- Whitespace check: `git diff --check`

## Project Structure

- `src/server/import/productCategoryNormalization.ts` — pure classifier and evidence.
- `src/server/import/productCategoryNormalization.test.ts` — representative positive, conflict, and negative cases.
- `scripts/normalize-product-categories.ts` — live preview, backup, and guarded apply.
- `src/lib/productCategories.ts` — stable English/Thai category definitions.
- `outputs/product-category-normalization-backups/` — uncommitted recovery artifacts.

## Code Style

Use explicit, auditable evidence rules. Product-family rules are anchored; generic therapeutic terms use normalized whole-word matching. A result includes the reason that won.

```ts
{
  category: "First Aid & Wound Care",
  confidence: "high",
  reason: "product-family:neoplast",
}
```

## Testing Strategy

- Write failing unit cases before each classifier increment.
- Cover exact product families, common retail brands, generic ingredients, Thai/English use terms, conflicts, and false-positive guards.
- Preview against the complete live catalog after each meaningful rule expansion.
- Review counts and representative samples for every destination category before applying.

## Boundaries

- Always: preserve explicitly selected non-fallback categories.
- Always: ignore household/dangerous/specially-controlled labels as category evidence.
- Always: require a unique high-confidence result for an automatic bulk reassignment.
- Always: back up product ID, prior category, new category, confidence, and reason before applying.
- Allowed by user confirmation: re-evaluate products currently in the fallback category and update clear matches in the live database.
- Never: force evidence-free or conflicting products out of the fallback category.
- Never: add a database schema, dependency, or external network classifier for this pass.

## Success Criteria

- Every active product remains assigned to exactly one of the 18 normalized categories.
- At least 25% of the current fallback products are reassigned with unique high-confidence evidence.
- The preview reports before/after category counts, reassignment counts by reason, conflicts, and representative samples.
- Manual non-fallback assignments remain unchanged.
- A backup is written before the live transaction and the final live counts match the reviewed preview.
- Focused normalization/import tests pass and `git diff --check` succeeds.

## Open Questions

None. The user confirmed primary retail use, high-confidence maximization, and preserving genuinely ambiguous products as fallback.
