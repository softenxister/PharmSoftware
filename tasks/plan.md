# Implementation Plan: Sales Reports UI

**Status:** Implemented on `codex/sales-reports`.

## Goal

Replace the blank `/analysis` page with one dense desktop/tablet sales-report workspace containing the four report views from the reference:

1. Daily sales summary
2. Profit/loss by bill
3. Product sales summary
4. Profit/loss by product

Keep the existing route and pharmacy-green visual language. All views share the same date range and include paid sales only.

## Proposed UI

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Management reports / รายงานเพื่อการบริหาร                                  │
│ Sales reports / รายงานการขาย                     [Export CSV] [Print]       │
│ Calculation basis: recorded prices include VAT · 7%                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Daily sales] [Profit by bill] [Product sales] [Profit by product]           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Date [Today] [7 days] [30 days] [Custom: 01 Aug — 13 Aug] [Apply]           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Net collected      VAT       Cost      Gross difference / margin            │
│ ฿96,300             ฿6,300    ฿50,000  ฿46,300 · 48.1%                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Active report title                                      128 rows            │
│ ┌ Date/Bill/Product ┬ Sales ┬ Discount ┬ VAT ┬ Cost ┬ Profit ┬ Margin ┐     │
│ │ ...                                                                    │     │
│ └────────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Structure and behavior

- Use four equal-width selector cells, implemented as accessible tabs. The active tab uses a soft green surface and bottom indicator.
- Keep selectors horizontally scrollable at tablet width so Thai labels remain readable.
- Store view/range in URL parameters: `view`, `range`, `from`, and `to`.
- Initialize range from the existing `analysisDefaultRange` preference.
- Show an always-visible calculation-basis badge below the title; never hide whether prices include VAT.
- Export and print act on the active report and exact active filters.
- Selecting a row drills down: a day opens its bills; a bill opens line detail and receipt link; a product opens contributing sale lines.

## Four Report Views

### Daily sales summary

Purpose: actual collected amount from paid bills per calendar day.

- Metrics: net collected, bill discount, VAT, cost/gross difference.
- Columns: date, paid bills, items, net collected, bill discount, VAT, cost, gross difference, margin.
- Selecting a date switches to bill profit with that date applied.

### Profit/loss by bill

Purpose: each paid bill's collected amount minus historical line cost.

- Metrics: paid bills, net collected, cost, gross difference/margin.
- Columns: bill number, date/time, customer name, payment, gross product value, item discount, bill discount, VAT, net collected, cost, gross difference, margin.
- Detail drawer: product lines, quantity, sell value, cost basis, cost-completeness status, and receipt link.

### Product sales summary

Purpose: product value after item discount and before end-of-bill discount.

- Metrics: product sales value, quantity, unique products, represented bills.
- Columns: product code/name, pack/unit, quantity, bill count, average sell price, gross value, item discount, product sales value.
- Recommended rule: item-level discounts reduce their product; bill-level discounts remain unallocated unless the business defines an allocation rule.

### Profit/loss by product

Purpose: VAT-inclusive product sales value minus historical product cost, before end-of-bill discount.

- Metrics: product sales value, product cost, gross difference, margin.
- Columns: product code/name, pack/unit, quantity, product sales value, average unit cost, total cost, gross difference, margin, cost completeness.
- Detail drawer identifies contributing lines whose historical cost is unavailable.

## Calculation Rules

- Use `Sale.netTotal` as collected amount, not `customerPaid`, because tender can include change.
- Match the current receipt contract: recorded prices are VAT-inclusive and VAT is extracted at 7%.
- Call `net collected − cost` **gross difference** until accounting confirms it is valid to label as gross profit when VAT is included.
- Keep the calculation basis visible below the report title.
- Use Thai baht and active-locale date formatting; maintain English/Thai key parity.

## Immutable Data Policy

Using today's latest purchase cost for an old sale would rewrite history. The implementation therefore:

- Snapshots normalized cost/source, product identity, pack, and item discount in each paid receipt snapshot.
- Persists the receipt VAT basis/rate/amount alongside the immutable sale totals.
- Keep old rows readable, but show `Cost unavailable`; never silently treat missing cost as zero or today's cost.
- Show a completeness banner such as `Cost available for 93 of 100 sold lines`.

## Component Ownership

Keep `src/pages/analysis/AnalysisPage.tsx` as a thin route seam. Add a deep feature module:

```text
src/features/reports/sales/
  SalesReports.tsx
  SalesReports.module.css
  SalesReportSelector.tsx
  SalesReportFilters.tsx
  SalesReportMetrics.tsx
  SalesReportTable.tsx
  SalesReportDetailDrawer.tsx
  salesReportClient.ts
  salesReportModel.ts
  salesReportModel.test.ts

server/routes/reports/sales.ts
server/db/reports/salesReportRepository.ts
```

- Aggregate and paginate on the server; do not fetch all sales for browser-side totals.
- Return only the active view/page.
- Add a reports-specific i18n catalog.
- Reuse theme tokens, preference formatting, and the existing receipt route.

## States, Permissions, and Accessibility

- Loading: stable metric/table skeletons.
- Empty: `No paid sales in this period` plus a wider-range action.
- Error: inline Retry without losing filters.
- Missing cost: amber text/icon banner and `—` cells, never a fabricated total.
- Recommended permissions: both roles see sales-only totals; owner-only cost/profit tabs and fields unless explicitly granted. Enforce this in the API.
- Use semantic tabs, labeled controls, table headers, focus-managed drawers, keyboard row activation, and an `aria-live` export status.
- Keep the identifying table column sticky and allow horizontal table scrolling at 768 px/1024 px.
- Verify at 768 px, 1024 px, and 1440 px; the app is desktop/tablet-first.

## Ordered Tasks

### Task 1: Persist immutable report amounts

- [x] Save historical cost/source and item-discount data in paid receipt snapshots.
- [x] Preserve receipt VAT basis/rate/amount with the sale.
- [x] Test purchase cost, migrated cost, unavailable cost, discounts, and inclusive VAT.

**Dependencies:** None. **Scope:** Medium.

### Task 2: Daily summary vertical slice

- [x] Build authoritative query/API plus URL-backed filters and daily UI.
- [x] Default Reports to the saved range and paid sales only.
- [x] Test pharmacy-timezone day boundaries and URL state; implement loading, empty, and error states.

**Dependencies:** Task 1. **Scope:** Medium.

### Task 3: Profit/loss by bill

- [x] Add bill aggregation, cost completeness, detail drawer, and receipt link.
- [x] Reconcile row totals to metrics and test keyboard/focus behavior.

**Dependencies:** Tasks 1–2. **Scope:** Medium.

### Task 4: Product sales summary

- [x] Aggregate by product and pack/unit after item discounts and before bill discount.
- [x] Test aggregation, item discounts, contribution ordering, and unallocated bill discounts.

**Dependencies:** Task 2. **Scope:** Medium.

### Task 5: Profit/loss by product

- [x] Use only sale-time cost snapshots and expose completeness at all levels.
- [x] Test mixed complete/incomplete costs and owner-only access if approved.

**Dependencies:** Tasks 1 and 4. **Scope:** Small–Medium.

### Task 6: Export, print, and polish

- [x] Export the active report/filter with totals matching the API.
- [x] Add clean report-only print output.
- [x] Verify bilingual copy, keyboard drawer controls, overflow, and desktop/1024 px layouts.

**Dependencies:** Tasks 2–5. **Scope:** Medium.

## Checkpoints

- After Tasks 1–2: daily report is trustworthy end to end; user reviews density and labels.
- After Tasks 3–5: all four views reconcile; every aggregate can be drilled into; missing cost is never mistaken for zero.
- After Task 6: permissions, bilingual UI, accessibility, export, print, and responsive behavior are verified.

## Implemented Decisions

- Recorded selling prices are VAT-inclusive at the current 7% receipt rate.
- Item discounts reduce product sales value.
- Bill discounts remain unallocated in product reports.
- Pharmacists see sales-only reports; cost/profit views and contribution cost fields are owner-only.
- Legacy sales without immutable snapshots use the latest received purchase cost as of the sale date, then migration cost; they remain incomplete only when neither exists.

