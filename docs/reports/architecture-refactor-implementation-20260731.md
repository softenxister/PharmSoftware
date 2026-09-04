# Project architecture refactor — implementation summary

**Status:** Implemented  
**Branch:** `refactor/project-module-architecture`  
**Date:** 2026-07-31  
**Baseline:** `cc82b4b3` (`main`)  
**Latest implementation commit:** `c9089e72`

The architecture plan has been implemented across the project. The seven large or structurally shallow areas were reorganized into deep modules with one clear external seam and locally owned implementation files. CSS and generated Prisma code are excluded from the line policy.

## Result

- Handwritten implementation files reviewed: all files under `src`, `server`, `scripts`, and `prisma`.
- Normal target: approximately 300–500 lines maximum per implementation file.
- Two reviewed cohesive exceptions remain:
  - `src/features/sales/new/workflow/useSaleWorkflow.ts` — 550 lines.
  - `src/features/purchase/new/workflow/usePurchaseWorkflow.ts` — 545 lines.
- Next-largest handwritten implementation file:
  - `src/features/stock/adjustment/StockAdjustment.tsx` — 492 lines; retained as one cohesive adjustment workflow.
- No compatibility barrels or duplicate re-export layers were left behind.
- `server/db/stockRepository.ts`, `src/features/stock/StockEntryForm.tsx`,
  `src/features/sales/new/salesPresentation.ts`, and
  `src/features/purchase/purchaseUtils.ts` were removed after direct callers moved.
- Database schema and existing HTTP contracts were not changed.
- No runtime dependency was added.

## Implemented module structure

### Sale workflow

```text
src/features/sales/new/
├── NewSale.tsx                                  50
├── PosConfirmationDialog.tsx                    73
├── salesShortcuts.ts                            40
└── workflow/
    ├── useSaleWorkflow.ts                      550
    ├── useSaleCart.ts                          365
    ├── useSaleCatalog.ts                       182
    ├── useSalePayment.ts                       127
    ├── useSaleRecommendations.ts                47
    ├── saleDraft.ts                            431
    ├── salePersistence.ts                      142
    ├── saleCatalog.ts                           95
    ├── saleTypes.ts                            157
    ├── SaleToolbar.tsx                         124
    ├── SaleCustomerField.tsx                   121
    ├── SaleItemEntry.tsx                       255
    ├── SaleCartTable.tsx                       109
    ├── SaleProductBrowser.tsx                   80
    ├── SaleSummaryBar.tsx                       44
    ├── SaleReminderPanel.tsx                   123
    ├── SalePaymentPanel.tsx                    154
    ├── SaleCompletionDialog.tsx                 82
    ├── SaleSettingsDialog.tsx                  109
    └── SalePrimitives.tsx                      145
```

`NewSale` is now a composition seam. `useSaleWorkflow` owns the Sale lifecycle;
catalog discovery, cart transitions, payment-step state, persistence, and focused
views are privately owned by the workflow module. Pending saves retain complete
line data, while paid submission continues to update stock and then expose receipt
printing.

### Purchase workflow

```text
src/features/purchase/new/
├── PurchaseEntry.tsx                           269
└── workflow/
    ├── usePurchaseWorkflow.ts                  545
    ├── purchaseDraft.ts                        151
    ├── purchasePersistence.ts                   77
    ├── PurchaseDetailsPanel.tsx                115
    ├── PurchaseLineEditor.tsx                  167
    └── PurchaseLineTable.tsx                    62
```

`PurchaseEntry` composes the workflow. Draft calculations and save guards belong
to `purchaseDraft`; request construction belongs to `purchasePersistence`.
Expiry behavior imports directly from `src/lib/expiryDate.ts`; the old
`purchaseUtils.ts` alias layer was deleted.

### Product entry

```text
src/features/product/entry/
├── ProductEntryForm.tsx                        288
├── useProductItemDraft.ts                      157
├── productItemDraft.ts                         302
├── productEditorLifecycle.ts                   196
├── useProductEditorLifecycle.ts                107
├── productEditorPersistence.ts                  24
├── productEditorRoute.ts                        21
├── ProductIdentityFields.tsx                   142
├── ProductPackagingEditor.tsx                  149
├── ProductCompositionPanel.tsx                  47
├── ProductRegulatoryFields.tsx                  32
├── ProductPhotoField.tsx                        59
└── ProductDeleteDialog.tsx                      77
```

Product identity and packaging now live under the Product domain. The deep
Product editor lifecycle also owns route-linked opening, Product write selection,
photo ordering, deletion, cache invalidation, and visible-page reconciliation
behind one hook consumed by Inventory. HTTP and cache access cross a tested
adapter seam. The reusable custom searchable control lives at
`src/components/forms/SearchableSelect.tsx`.

### Stock inventory

```text
src/pages/stock/StockPage.tsx                     5
src/features/stock/inventory/
├── StockInventory.tsx                           77
├── useStockInventory.ts                        299
├── stockInventoryModel.ts                      272
├── StockInventoryFilters.tsx                   280
└── StockInventoryTable.tsx                     290
```

The route page is only an entry seam. Inventory owns authoritative reads,
filters, totals, pagination, and Product form composition, while Product owns
the editor lifecycle. The removed client-side second filtering pass can no
longer disagree with totals or pagination.

### Stock persistence

```text
server/db/stock/
├── stockCatalogRepository.ts                   386
├── stockProductProjection.ts                   102
├── stockItemRepository.ts                      303
└── stockMovementRepository.ts                  111

server/product-images/
└── stockPhotoStorage.ts                        145
```

Reads, projection, item writes, quantity movement, and photo maintenance now have
separate owners. Callers import the owner directly; the 1,028-line
`stockRepository.ts` facade was deleted.

### Member detail

```text
src/features/member/detail/
├── MemberDetail.tsx                             67
├── useMemberProfile.ts                         250
├── memberProfileDraft.ts                        62
├── memberProfileTypes.ts                        44
├── MemberSummary.tsx                            68
├── MemberAllergyPanel.tsx                       32
├── MemberPurchaseHistory.tsx                   209
└── MemberProfileDialog.tsx                     228
```

The route seam, profile lifecycle, editable draft, summary, allergy safety, and
purchase history are now separated by responsibility inside one Member module.

### I18n catalog

```text
src/i18n/
├── i18n.ts                                      40
└── catalog/
    ├── assembleCatalog.ts                       48
    ├── authCatalog.ts                           49
    ├── dashboardCatalog.ts                      91
    ├── sharedCatalog.ts                         86
    ├── memberCatalog.ts                        151
    ├── purchaseCatalog.ts                      195
    ├── salesCatalog.ts                         229
    ├── settingsCatalog.ts                      283
    └── stockCatalog.ts                         275
```

The public translation interface is unchanged. English and Thai entries stay
together by domain, and assembly tests enforce key and placeholder parity.

## Files reviewed and intentionally kept intact

| File | Lines | Reason |
| --- | ---: | --- |
| `src/features/stock/adjustment/StockAdjustment.tsx` | 492 | One cohesive stock-adjustment workflow; review if it grows. |
| `server/db/memberRepository.ts` | 465 | Focused Member read model and persistence owner. |
| `server/product-images/s3Storage.ts` | 437 | Focused object-storage adapter. |
| `server/import/productCategoryNormalization.ts` | 436 | Cohesive import normalization pipeline. |
| `server/db/saleRepository.ts` | 429 | Focused Sale persistence owner. |
| `server/import/cwStockNormalizer.ts` | 417 | Cohesive import normalization module. |
| `server/db/cwStockMigrationRepository.ts` | 403 | Focused migration persistence owner. |
| `server/receipts/receiptPdf.ts` | 392 | Focused receipt PDF renderer. |

## Verification

- Focused tests were run after every increment.
- Final full suite passed: 383 tests, 0 failures.
- Full TypeScript check passed: `npm run typecheck`.
- Production client and SSR builds passed: `npm run build`.
- Sale tests cover pricing, batch allocation, keyboard input, shortcuts,
  paid receipt routing, payable guards, and pending-line persistence.
- Purchase tests cover totals, expiry normalization/validation, and save guards.
- I18n tests cover exact catalog parity and placeholders.
- `git diff --check` passed after each increment.
- No Chrome DevTools MCP was used. Application screens were not visually
  exercised because no development server was started. In-app browser
  verification was attempted for the static report, but no browser was
  available in this session; the report is structurally validated only.

## Commits

| Commit | Change |
| --- | --- |
| `73deeed3` | Record deep-module refactor plan and domain decisions. |
| `3bfee3e7` | Split translation catalog by domain. |
| `e3c2db12` | Deepen Member profile module. |
| `afd7e678` | Move product entry into a deep Product module. |
| `bf85b670` | Deepen authoritative Stock inventory. |
| `8340696d` | Split Stock persistence by responsibility. |
| `8bb46c93` | Deepen Purchase workflow module. |
| `425dee5e` | Deepen Sale workflow module. |
| `c9089e72` | Remove shallow Purchase utility aliases. |

The detailed, aligned HTML version is
`docs/reports/architecture-refactor-implementation-20260731.html`.
