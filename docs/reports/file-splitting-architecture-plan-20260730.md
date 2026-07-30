# Pharm File-Splitting Architecture Plan

**Status:** Implemented

**Date:** 2026-07-31

**Scope:** Entire handwritten TypeScript/TSX implementation

[Open the visual HTML report](./file-splitting-architecture-plan-20260730.html)

[Open the final implementation report](./architecture-refactor-implementation-20260731.html)

## Refactoring rule

- Prefer **250–400 lines** for handwritten implementation files.
- Review files approaching **500 lines** and permit a rare documented exception up to roughly **550 lines** when splitting would create a shallow interface.
- CSS and generated Prisma code are excluded.
- Tests are evaluated by readability, not by the implementation-file ceiling.
- Do not create shallow pass-through files, broad barrels, or JSX files with callback-heavy interfaces merely to reduce line counts.
- Keep each split inside the owning module folder.
- Tests should cross the deep module's interface rather than target private implementation.
- Preserve behavior, desktop/tablet workflow, database schema, and HTTP contracts unless a separately tested correctness fix is approved.
- Keep ADR-001's top-level structure and use no new runtime dependencies.

## Scope audit

| Current file | Lines | Planned module |
| --- | ---: | --- |
| `src/features/sales/new/NewSale.tsx` | 2,541 | Sale workflow |
| `src/i18n/i18n.ts` | 1,364 | I18n catalog |
| `src/features/purchase/new/PurchaseEntry.tsx` | 1,182 | Purchase workflow |
| `server/db/stockRepository.ts` | 1,028 | Stock persistence |
| `src/pages/stock/StockPage.tsx` | 968 | Stock inventory |
| `src/features/stock/StockEntryForm.tsx` | 805 | Stock item entry |
| `src/features/member/detail/MemberDetail.tsx` | 542 | Member profile |

## 1. Sale workflow

### Target folder

```text
src/features/sales/new/
├── NewSale.tsx
├── workflow/
│   ├── useSaleWorkflow.ts
│   ├── saleDraft.ts
│   ├── salePersistence.ts
│   ├── SaleToolbar.tsx
│   ├── SaleCustomerField.tsx
│   ├── SaleItemEntry.tsx
│   ├── SaleCartTable.tsx
│   ├── SaleReminderPanel.tsx
│   ├── SalePaymentPanel.tsx
│   ├── SaleCompletionDialog.tsx
│   └── SaleSettingsDialog.tsx
├── PosConfirmationDialog.tsx
├── salesShortcuts.ts
└── NewSale.module.css
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `NewSale.tsx` | 100–160 | `NewSale` | External Sale workflow seam and layout composition only. |
| `workflow/useSaleWorkflow.ts` | 350–450 | `useSaleWorkflow` | Own remote loading, pending-bill reopen, submission, stock refresh, and Sale outcomes. |
| `workflow/saleDraft.ts` | 300–400 | `reduceSaleDraft` | Own cart, batch allocation, quantity, discount, reminder, and pricing transitions. |
| `workflow/salePersistence.ts` | 200–280 | `persistSaleWorkflow` | Translate a valid draft into pending or paid persistence requests and normalized results. |
| `workflow/SaleToolbar.tsx` | 120–180 | `SaleToolbar` | Bill date, owner, pharmacist, Save, Save & New, and settings entry. |
| `workflow/SaleCustomerField.tsx` | 180–240 | `SaleCustomerField` | Customer search, selection, member summary, and allergy context. |
| `workflow/SaleItemEntry.tsx` | 300–400 | `SaleItemEntry` | Item search, barcode handling, pack selection, batch selection, and quantity commit. |
| `workflow/SaleCartTable.tsx` | 320–420 | `SaleCartTable` | Grouped Sale lines, quantity edits, line removal, and stock visibility. |
| `workflow/SaleReminderPanel.tsx` | 180–260 | `SaleReminderPanel` | Dose reminder eligibility, time selection, keyboard movement, and dose editing. |
| `workflow/SalePaymentPanel.tsx` | 280–380 | `SalePaymentPanel` | Totals, bill discount, payment method, cash received, change, and paid submission. |
| `workflow/SaleCompletionDialog.tsx` | 150–220 | `SaleCompletionDialog` | Paid outcome, receipt action, and next-Sale choice. |
| `workflow/SaleSettingsDialog.tsx` | 140–220 | `SaleSettingsDialog` | Receipt paper, printer, and cash-drawer settings. |

**Migration note:** absorb the cohesive cart/pricing functions from `salesPresentation.ts` into `saleDraft.ts`; keep only truly shared presentation functions or delete the shallow module after callers move.

**Test surface:** `reduceSaleDraft`, `useSaleWorkflow`, and `persistSaleWorkflow`.

## 2. I18n catalog

### Target folder

```text
src/i18n/
├── i18n.ts
├── catalog/
│   ├── assembleCatalog.ts
│   ├── sharedCatalog.ts
│   ├── salesCatalog.ts
│   ├── stockCatalog.ts
│   ├── purchaseCatalog.ts
│   ├── memberCatalog.ts
│   ├── settingsCatalog.ts
│   └── migrationCatalog.ts
├── productUnits.ts
└── i18n.test.ts
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `i18n.ts` | 100–160 | `translate`, `formatDate`, `formatNumber`, `formatMoney` | Preserve the existing external I18n interface. |
| `catalog/assembleCatalog.ts` | 80–140 | `assembleCatalog` | Compose catalogs and enforce English-key/Thai-key and placeholder parity. |
| `catalog/sharedCatalog.ts` | 180–280 | `sharedCatalog` | Common, navigation, authentication, and shared form text in both languages. |
| `catalog/salesCatalog.ts` | 260–380 | `salesCatalog` | Sale home, New Sale, payment, receipt, and reminder text. |
| `catalog/stockCatalog.ts` | 300–420 | `stockCatalog` | Stock inventory, item entry, adjustment, filters, and item detail text. |
| `catalog/purchaseCatalog.ts` | 220–340 | `purchaseCatalog` | Purchase workflow, workflow status, corrections, and distributor text. |
| `catalog/memberCatalog.ts` | 180–300 | `memberCatalog` | Member directory, Member profile, allergy, and history text. |
| `catalog/settingsCatalog.ts` | 220–340 | `settingsCatalog` | Account, staff, appearance, POS preferences, store profile, and image settings text. |
| `catalog/migrationCatalog.ts` | 180–300 | `migrationCatalog` | Stock, Member, Distributor, category, measurement, and expiry migration text. |

**Locality rule:** pair English and Thai entries in the same domain catalog. The catalog files are private implementation, not new public seams.

**Test surface:** the unchanged `translate` interface plus catalog assembly parity checks.

## 3. Purchase workflow

### Target folder

```text
src/features/purchase/new/
├── PurchaseEntry.tsx
├── workflow/
│   ├── usePurchaseWorkflow.ts
│   ├── purchaseDraft.ts
│   ├── purchasePersistence.ts
│   ├── PurchaseDetailsPanel.tsx
│   ├── PurchaseLineEditor.tsx
│   ├── PurchaseLineTable.tsx
│   └── PurchaseTotalsPanel.tsx
├── PurchaseWorkflowBar.tsx
├── PurchaseUnitDropdown.tsx
├── PurchaseCorrectionDialog.tsx
└── PurchaseEntry.module.css
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `PurchaseEntry.tsx` | 120–180 | `PurchaseEntry` | External Purchase workflow seam and layout composition. |
| `workflow/usePurchaseWorkflow.ts` | 340–450 | `usePurchaseWorkflow` | Load/create/edit lifecycle, permissions, status, correction state, and persistence outcomes. |
| `workflow/purchaseDraft.ts` | 240–340 | `reducePurchaseDraft` | Line draft, pack multipliers, totals, VAT, adjustment, and required-value rules. |
| `workflow/purchasePersistence.ts` | 160–240 | `persistPurchaseWorkflow` | Build save/correction requests and normalize responses. |
| `workflow/PurchaseDetailsPanel.tsx` | 180–260 | `PurchaseDetailsPanel` | Distributor, bill number, date, status, and review fields. |
| `workflow/PurchaseLineEditor.tsx` | 300–420 | `PurchaseLineEditor` | Catalog search, barcode selection, unit, quantity, cost, free quantity, lot, and expiry. |
| `workflow/PurchaseLineTable.tsx` | 220–320 | `PurchaseLineTable` | Saved line display, removal, and quantity/cost presentation. |
| `workflow/PurchaseTotalsPanel.tsx` | 180–260 | `PurchaseTotalsPanel` | Subtotal, VAT, adjustment, net total, and save actions. |

**Migration note:** import expiry functions directly from `src/lib/expiryDate.ts`; absorb `canSavePurchase` into `purchaseDraft.ts`, then delete the shallow aliases in `purchaseUtils.ts` if no caller remains.

**Test surface:** `reducePurchaseDraft`, `usePurchaseWorkflow`, and persistence outcomes for draft, partial, received, and correction paths.

## 4. Stock persistence

### Target folders

```text
server/db/stock/
├── stockCatalogRepository.ts
├── stockProductProjection.ts
├── stockItemRepository.ts
├── stockMovementRepository.ts
├── stockItemMapper.ts
├── stockItemDetail.ts
└── stockReadQuery.ts

server/product-images/
└── stockPhotoStorage.ts
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `db/stock/stockCatalogRepository.ts` | 380–480 | `readStockProducts` | Authoritative Stock query, filtering, sorting, paging, weekly sales, and batch-cost reads. |
| `db/stock/stockProductProjection.ts` | 160–240 | `projectStockProduct` | Convert database product graphs and aggregates into `SalesProduct`. |
| `db/stock/stockItemRepository.ts` | 340–450 | `saveStockItem`, `updateStockItemDetail`, `deleteStockItem` | Barcode checks, product/pack/batch upsert, item detail changes, and soft deletion. |
| `db/stock/stockMovementRepository.ts` | 180–280 | `receivePurchasedStock`, `dispenseSoldStock` | Batch identity, receipt, dispense ordering, locking, and quantity invariants shared by Purchase and Sale. |
| `product-images/stockPhotoStorage.ts` | 260–360 | `storeAllExternalStockPhotos` | Bulk image eligibility, storage concurrency, persistence, cleanup, and failure result. |

**Migration note:** delete `server/db/stockRepository.ts` after callers import the owning deep module directly. Do not leave a shallow re-export file.

**Test surface:** Stock catalog query outcomes, Stock item write outcomes, Stock movement invariants, and product-image storage outcomes.

## 5. Stock inventory

### Target folder

```text
src/pages/stock/
└── StockPage.tsx

src/features/stock/inventory/
├── StockInventory.tsx
├── useStockInventory.ts
├── stockInventoryModel.ts
├── StockInventoryFilters.tsx
└── StockInventoryTable.tsx
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `pages/stock/StockPage.tsx` | 15–35 | `StockPage` | Lazy route entry that renders the Stock inventory module. |
| `inventory/StockInventory.tsx` | 180–260 | `StockInventory` | External feature seam and inventory layout composition. |
| `inventory/useStockInventory.ts` | 320–440 | `useStockInventory` | Query, draft/applied filters, sort, paging, request cancellation, and mutation reconciliation. |
| `inventory/stockInventoryModel.ts` | 200–300 | `projectStockInventory` | Stock row projection, stable filter criteria, range parsing, and sort descriptions. |
| `inventory/StockInventoryFilters.tsx` | 260–360 | `StockInventoryFilters` | Search and filter controls, option lists, apply/reset behavior, and resize handle. |
| `inventory/StockInventoryTable.tsx` | 300–420 | `StockInventoryTable` | Sort headers, rows, state labels, actions, loading, and empty results. |

**Correctness requirement:** remove local filtering over only the current server page. The server read remains authoritative so visible rows, totals, pagination, and filter options cannot disagree.

**ADR alignment:** restores ADR-001 by keeping the page entry small and moving Stock implementation to `src/features/stock`.

**Test surface:** `useStockInventory` behavior through its interface and authoritative server query outcomes.

## 6. Stock item entry

### Target folder

```text
src/features/stock/entry/
├── StockEntryForm.tsx
├── useStockItemDraft.ts
├── stockItemDraft.ts
├── SearchableStockSelect.tsx
├── StockPhotoField.tsx
├── StockIdentityFields.tsx
├── StockPackagingEditor.tsx
├── StockRegulatoryFields.tsx
└── StockDeleteDialog.tsx
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `entry/StockEntryForm.tsx` | 150–220 | `StockEntryForm` | Form seam, section composition, submit, and focus ownership. |
| `entry/useStockItemDraft.ts` | 300–420 | `useStockItemDraft` | Draft initialization, save/delete state, keyboard flow, and serialization outcomes. |
| `entry/stockItemDraft.ts` | 220–320 | `reduceStockItemDraft` | Normalization, required-value rules, packaging-row transitions, and regulatory-form transitions. |
| `entry/SearchableStockSelect.tsx` | 160–240 | `SearchableStockSelect` | Custom searchable selectable field used by Stock entry and Stock detail. |
| `entry/StockPhotoField.tsx` | 130–200 | `StockPhotoField` | Photo URL preview, input, and replacement action. |
| `entry/StockIdentityFields.tsx` | 220–320 | `StockIdentityFields` | Barcode, name, brand, manufacturer, category, location, price, and measurement fields. |
| `entry/StockPackagingEditor.tsx` | 260–380 | `StockPackagingEditor` | Parent/child pack rows, multiplier, barcode, price, add/remove, and keyboard flow. |
| `entry/StockRegulatoryFields.tsx` | 140–220 | `StockRegulatoryFields` | Regulatory form selection and active-ingredient presentation. |
| `entry/StockDeleteDialog.tsx` | 120–180 | `StockDeleteDialog` | Delete confirmation, pending state, and error presentation. |

**Migration note:** move `SearchableSelect` out of `StockEntryForm.tsx`; `StockItemDetailDialog` should import the correctly owned selectable-field module.

**Test surface:** `reduceStockItemDraft`, `useStockItemDraft`, and one browser-level form interaction path.

## 7. Member profile

### Target folder

```text
src/features/member/detail/
├── MemberDetail.tsx
├── useMemberProfile.ts
├── memberProfileDraft.ts
├── MemberSummary.tsx
├── MemberAllergyPanel.tsx
├── MemberPurchaseHistory.tsx
├── MemberProfileDialog.tsx
└── MemberDetail.module.css
```

| Proposed file | Target lines | Main export/function | Main responsibility |
| --- | ---: | --- | --- |
| `MemberDetail.tsx` | 100–160 | `MemberDetail` | Route parameter, Member profile seam, load/error/not-found state, and layout. |
| `useMemberProfile.ts` | 220–320 | `useMemberProfile` | Member load, profile save, ingredient search, avatar outcome, and edit lifecycle. |
| `memberProfileDraft.ts` | 160–240 | `reduceMemberProfileDraft` | Name, Thai phone, avatar, allergy selection, dirty state, and request serialization. |
| `MemberSummary.tsx` | 100–160 | `MemberSummary` | Member identity, rank, points, totals, and contact summary. |
| `MemberAllergyPanel.tsx` | 140–220 | `MemberAllergyPanel` | Read-only allergy safety display and empty state. |
| `MemberPurchaseHistory.tsx` | 220–320 | `MemberPurchaseHistory` | Transaction/item tabs, status filter, time order, expansion, and line details. |
| `MemberProfileDialog.tsx` | 260–380 | `MemberProfileDialog` | Profile fields, avatar selection, ingredient search, allergy editing, validation, and save. |

**Locality rule:** keep Member identity/contact and allergy safety coherent; do not create a prop interface containing every state setter.

**Test surface:** `reduceMemberProfileDraft`, `useMemberProfile`, and observable profile-save/history outcomes.

## Files already inside the ceiling

These files should not be split by line count alone:

| File | Lines | Recommendation |
| --- | ---: | --- |
| `src/features/stock/adjustment/StockAdjustment.tsx` | 492 | Keep; review only if it grows. |
| `server/db/memberRepository.ts` | 465 | Keep; it already builds the Member read model. |
| `server/product-images/s3Storage.ts` | 437 | Keep; focused storage adapter. |
| `server/import/productCategoryNormalization.ts` | 436 | Keep; cohesive normalization implementation. |
| `server/db/saleRepository.ts` | 429 | Keep during UI refactor; reassess after Sale workflow tests. |
| `server/import/cwStockNormalizer.ts` | 417 | Keep; deep import normalization module. |
| `server/db/cwStockMigrationRepository.ts` | 403 | Keep; focused migration persistence. |
| `server/receipts/receiptPdf.ts` | 392 | Keep; focused PDF implementation. |
| `server/import/lotExpiryMigration.ts` | 368 | Keep; focused migration module. |
| `src/features/dashboard/Dashboard.tsx` | 369 | Keep; split later only if real data workflow arrives. |
| `server/import/distributorDataMigration.ts` | 352 | Keep; focused migration module. |
| `src/features/sales/SalesHome.tsx` | 322 | Keep. |
| `src/components/navigation/TopBar.tsx` | 316 | Keep. |
| `src/features/member/MemberDirectory.tsx` | 313 | Keep. |

## Recommended implementation order

1. I18n catalog — lowest behavioral risk; establishes the file-size pattern.
2. Member profile — smallest UI deepening; validates workflow/view separation.
3. Stock item entry — creates the reusable selectable-field ownership and draft module.
4. Stock inventory — restores ADR-001 and fixes page-local filtering drift.
5. Stock persistence — separates reads, item writes, Stock movement, and image maintenance.
6. Purchase workflow — deepens a transactional workflow after Stock movement exists.
7. Sale workflow — highest-risk and largest refactor; perform after the patterns and Stock seams are proven.

The top architectural priority remains Sale workflow, but the implementation order starts with lower-risk modules to establish and verify the pattern before touching paid and pending Sale behavior.
