# Pharm Agent Notes

Use these project rules for all future edits in this pharmacy retail software.

## Architecture Reference

- Treat `docs/reports/architecture-refactor-implementation-20260731.md` as the architectural baseline. Read the relevant section before changing module boundaries, ownership, persistence, or workflow structure; consult the companion HTML report only when a more detailed visual reference is useful.
- Preserve the implemented deep-module design: expose one small composition or route seam and keep state, calculations, persistence mapping, and focused views privately owned by their domain module.
- Prefer direct imports from the file that owns a responsibility. Do not introduce compatibility barrels, duplicate re-export layers, pass-through facades, or shallow utility aliases.
- Keep handwritten implementation files under `src`, `server`, `scripts`, and `prisma` focused and normally around 300–500 lines maximum. Split by responsibility when a file grows, but do not split a cohesive workflow only to satisfy a line count. CSS and generated Prisma code are excluded.
- Before creating or moving a file, inspect the domain map below and nearby examples. Extend the existing owner when the responsibility already has one; do not create a competing abstraction or duplicate helper.
- Preserve existing database schema and HTTP contracts unless the task explicitly requires changing them. Do not add runtime dependencies for refactors without a concrete need and user approval.
- When architecture guidance conflicts with current code or requested behavior, surface the conflict rather than silently creating a second pattern. Update this section and the full architecture report when an intentional architectural change makes either reference stale.

### Domain Ownership Map

- Sale entry: `src/features/sales/new/NewSale.tsx` is the composition seam; `src/features/sales/new/workflow/` owns lifecycle, catalog, cart, payment, persistence, drafts, and focused Sale views.
- Purchase entry: `src/features/purchase/new/PurchaseEntry.tsx` composes `src/features/purchase/new/workflow/`; draft calculations and guards belong in `purchaseDraft.ts`, request construction in `purchasePersistence.ts`, and shared expiry behavior in `src/lib/expiryDate.ts`.
- Product entry: `src/features/product/entry/` owns product identity, packaging, composition, regulatory data, photos, draft state, and delete behavior. Reusable searchable selects belong in `src/components/forms/SearchableSelect.tsx`.
- Stock inventory: `src/pages/stock/StockPage.tsx` is only the route seam; `src/features/stock/inventory/` owns the inventory UI and model. Treat server results as authoritative for filtering, totals, and pagination; do not add a second client-side filtering pass.
- Stock persistence: `server/db/stock/stockCatalogRepository.ts`, `stockProductProjection.ts`, `stockItemRepository.ts`, and `stockMovementRepository.ts` separately own reads, projections, item writes, and quantity movements. `server/product-images/stockPhotoStorage.ts` owns stock photo maintenance. Import these owners directly.
- Member detail: `src/features/member/detail/` owns profile lifecycle, editable drafts, summaries, allergy safety, and purchase history behind `MemberDetail.tsx`.
- I18n: `src/i18n/catalog/` stores English and Thai entries together by domain and assembles them through `assembleCatalog.ts`. Maintain exact key and placeholder parity without changing the public translation interface.

### Architecture Guardrails

- Do not recreate the removed `server/db/stockRepository.ts`, `src/features/stock/StockEntryForm.tsx`, `src/features/sales/new/salesPresentation.ts`, or `src/features/purchase/purchaseUtils.ts` layers.
- Pending Sale saves must retain complete line data so bills can reopen; paid Sale submission updates stock before receipt printing becomes available.
- Sale and Purchase guards, totals, normalization, persistence mapping, and state transitions should remain testable outside presentation components.
- Cohesive files near the normal size ceiling are acceptable. Review them when they grow, especially `useSaleWorkflow.ts`, `usePurchaseWorkflow.ts`, and `StockAdjustment.tsx`; split only at a clear ownership seam.

## Layout Stability

- Use rigid dimensions only where the workflow needs it, such as toolbar controls, fixed-format cards, summary bars, quantity controls, invoice rows, and customer fields.
- Item tables and item-entry areas may be flexible and extend naturally based on number of items or available desktop/tablet space.
- Do not let unusually long row values, customer names, phone/rank/point text, pack labels, or invoice values break alignment or create ugly layout jumps.
- Use fixed heights, min/max widths, `min-width: 0`, truncation, and ellipsis where needed, but avoid making every card or table rigid by default.
- Customer selected state should stay the same width and height as the empty customer field.
- Avoid UI shifting when a value changes from empty to populated.
- This software is designed for PC desktop and tablet pharmacy counters, not mobile-first phone layouts.
- Keep desktop/tablet layouts dense and ergonomic; do not over-optimize for narrow mobile screens at the cost of counter workflow.

## Null And Invalid Values

- Do not allow action buttons to run when required values are missing, null, invalid, NaN, empty, or zero.
- For sales, do not allow Save, Save & New, or Net Payable payment flow when there are no valid items or net payable is `0`, invalid, or NaN.
- Prefer both logic guards and disabled button styling.
- Pending payment bills must save enough item-line data to reopen the bill later.

## Sales Workflow

- Net Payable payment submit means the sale is paid.
- Top Save means pending payment/order, not paid.
- Print Receipt belongs after payment is received.
- Pending payment rows in `/sales` should reopen in `/sales/new` with the saved item list.

## Pharmacy Theme

- Keep the design quiet, modern, and suitable for retail pharmacy counter staff.
- Use shade-of-green pharmacy colors, but avoid shiny/neon green.
- Use restrained supporting colors only when useful, such as muted amber for pending and calm blue for invoice number.
- Keep the global font style consistent with the existing app.
- Prefer dense, practical POS layout over decorative or marketing-style UI.

## Form Controls

- Do not use native browser or OS dropdown styling for pharmacy app forms.
- Use custom searchable dropdown components like the pattern in `/sales/new`, especially for item, unit, packaging, category, manufacturer, and similar selectable fields.

## Verification

- Do not run npm commands unless the user explicitly asks.
- Use lightweight checks such as `git diff --check` after edits.
- Do not use or configure the Chrome DevTools MCP server for this project.
- If another browser-verification method is available, visually verify changed screens at desktop and tablet widths, exercise the affected interactions, inspect accessibility, and confirm the browser console has no errors or warnings.
- If browser verification is unavailable, say so explicitly and do not claim that the UI was visually verified.

## Symbols

- Don't over use logo in header
