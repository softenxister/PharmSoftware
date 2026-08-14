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

---

# Implementation Plan: Trusted Home Dashboard

## Goal

Replace the static home-dashboard mock with a compact operational dashboard backed by real sales, stock, and store-profile data. Remove **Need to Pay** and **Staff Overview** completely; neither has a trustworthy supporting workflow in the current product.

The home page should answer three questions quickly:

1. How is the store performing today?
2. Which stock needs attention now?
3. What is the fastest next action for the counter user?

## Recommended Information Hierarchy

### Global application top bar

Keep the existing global top bar focused on navigation and account controls. Do not place changing sales KPIs in it.

- Left: logo and primary navigation.
- Right: language, notifications when a real notification source exists, and user/profile controls.
- Optional: configured store name when it helps distinguish installations or future branches.

### Home-page header

Show identity and freshness, not analytics:

- Page title.
- Current Bangkok calendar date.
- Configured store name.
- Configured opening–closing hours.
- `Updated <time>` and a refresh action.
- Show `Open`/`Closed` only when both configured hours are valid and the status can be calculated in `Asia/Bangkok`; otherwise omit the status instead of guessing.

### Top summary strip

Use four equal cards at desktop width and a 2 × 2 grid at tablet width:

1. **Net sales today** — sum of `Sale.netTotal` for paid sales in the current Bangkok day. Compare with the same elapsed period yesterday so a partial day is not compared with a complete day.
2. **Paid bills** — count of paid sales today. Secondary line: member-bill count and percentage.
3. **Average bill** — net sales divided by paid bills; show `—` when there are no paid bills. Compare with the same elapsed period yesterday.
4. **Stock attention** — primary value is out-of-stock plus low-stock product count; secondary value is the number expiring within 30 days. The card links to `/stock` with the corresponding filter.

Do not put supplier payables, staff counts, or staff rankings in this strip.

### Main dashboard content

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Home · Store name · Bangkok date       Opening hours · Updated 10:42 [↻]  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│ Net sales today │ Paid bills      │ Average bill    │ Stock attention       │
│ ฿… · vs yday    │ … · members …% │ ฿… · vs yday    │ … low/out · … expiry  │
├───────────────────────────────────────────┬─────────────────────────────────┤
│ Sales today by hour                      │ Stock attention                  │
│ Today vs same elapsed period yesterday   │ Out / low / expiring soon lists │
│ Owner: gross difference + coverage note  │ [Open filtered stock]           │
├───────────────────────────────────────────┴─────────────────────────────────┤
│ Recent sales: paid and pending bills, with pending bills resumable          │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Keep the hourly sales comparison as the primary visualization.
- Replace the current margin-by-category mock with a compact stock-attention queue until a real category-margin query exists.
- Replace the three-card bottom row with recent sales across the full width; pending rows should reopen the existing sale workflow.
- Move **Top Member Purchase** out of the default home view. It belongs in Members/Reports unless loyalty ranking becomes an explicit daily workflow.
- Owners may see gross difference and margin inside the sales panel using the existing sales-report rules. Pharmacists must not receive cost/profit fields from the API.
- Never display profit as zero when historical cost coverage is incomplete; display `Unavailable` plus coverage.

## Data Contract and Ownership

Add one dashboard-specific endpoint rather than making the browser combine full report and inventory-page payloads:

```text
GET /api/dashboard?date=YYYY-MM-DD
```

Recommended response shape:

```ts
type DashboardResponse = {
  generatedAt: string;
  date: string;
  store: {
    name: string;
    openingTime: string;
    closingTime: string;
  };
  today: {
    netSales: number;
    paidBills: number;
    memberBills: number;
    averageBill: number | null;
    netSalesChangePercent: number | null;
    averageBillChangePercent: number | null;
  };
  inventory: {
    outOfStock: number;
    lowStock: number;
    expiringWithin30Days: number;
    items: Array<{
      productId: string;
      name: string;
      reason: "out-of-stock" | "low-stock" | "expiring";
      availableStock: number;
      expiryDate: string | null;
    }>;
  };
  hourlySales: Array<{
    hour: string;
    today: number;
    yesterday: number;
  }>;
  recentSales: Array<{
    id: string;
    billNo: string;
    soldAt: string;
    customerName: string;
    netTotal: number;
    status: "paid" | "pending";
  }>;
  ownerFinancials?: {
    grossDifference: number | null;
    marginPercent: number | null;
    pricedLines: number;
    totalLines: number;
  };
};
```

Ownership:

- `src/pages/dashboard/DashboardPage.tsx` remains the thin route seam.
- `src/features/dashboard/Dashboard.tsx` composes focused dashboard views.
- Add a small dashboard client/model hook under `src/features/dashboard/`; split visual sections only when the real-data component would otherwise exceed the repository size guidance.
- Add `server/routes/dashboard.ts` as the HTTP boundary and `server/db/dashboard/dashboardRepository.ts` as the authoritative aggregate owner.
- Reuse the pure report calculation rules where possible; do not duplicate VAT, cost, margin, or Bangkok-date logic.
- Reuse stock threshold semantics: out of stock is `<= 0`; low stock is `> 0` and below `minimumStock`.

## Ordered Tasks

### Task 1: Define and test dashboard calculations

**Description:** Create a pure dashboard model for Bangkok day boundaries, same-elapsed-period comparison, average bill, member share, stock classifications, and owner financial visibility.

**Acceptance criteria:**

- [ ] Paid sales alone contribute to sales KPIs; pending and voided sales do not.
- [ ] Zero-bill and zero-prior-period cases return `null` comparisons instead of `NaN`/infinity.
- [ ] Owner-only financial fields preserve incomplete-cost semantics.

**Verification:** Focused model tests cover Bangkok midnight, partial-day comparison, zero denominators, and role visibility.

**Dependencies:** None. **Estimated scope:** Medium (3–5 files).

### Task 2: Deliver the real dashboard API

**Description:** Add the authenticated dashboard endpoint and one repository query path for summary, hourly, inventory-alert, recent-sale, and store-profile data.

**Acceptance criteria:**

- [ ] One request returns all first-screen dashboard data and a server `generatedAt` timestamp.
- [ ] Pharmacist responses omit owner financials at the server boundary.
- [ ] Recent pending sales retain IDs needed to reopen `/sales/new`.

**Verification:** Route/repository tests reconcile seeded paid sales, pending sales, stock thresholds, expiry windows, store profile, and permission behavior.

**Dependencies:** Task 1. **Estimated scope:** Medium (3–5 files).

### Checkpoint: Trusted data foundation

- [ ] API totals reconcile with the daily sales report for the same Bangkok date.
- [ ] Stock counts reconcile with filtered stock inventory.
- [ ] No dashboard metric is hardcoded.

### Task 3: Replace the header and KPI mock

**Description:** Bind the home header and four summary cards to the dashboard response, with stable loading, empty, stale, and error states.

**Acceptance criteria:**

- [ ] Header shows configured store information, current date, data freshness, and safe open/closed behavior.
- [ ] KPI cards use the defined labels, calculations, and filtered destinations.
- [ ] Layout stays dense and stable at 768 px, 1024 px, and 1440 px.

**Verification:** Component/model tests for labels and state selection; manual desktop/tablet visual check when browser verification is available.

**Dependencies:** Task 2. **Estimated scope:** Medium (3–5 files).

### Task 4: Build sales and stock action panels

**Description:** Connect the hourly chart and stock-attention queue to real data, including owner-only financial context and stock drill-through links.

**Acceptance criteria:**

- [ ] Hourly chart compares only elapsed hours and has accessible text equivalents/tooltips.
- [ ] Stock alert rows identify the reason and open the matching stock filter.
- [ ] Profit fields are absent for pharmacists and never fabricated when cost is incomplete.

**Verification:** Focused UI tests plus manual interaction and overflow checks.

**Dependencies:** Tasks 2–3. **Estimated scope:** Medium (3–5 files).

### Task 5: Replace the bottom row with recent sales

**Description:** Remove Need to Pay, Staff Overview, and Top Member Purchase from home; add a compact recent-sales list with paid/pending states and resumable pending bills.

**Acceptance criteria:**

- [ ] No payable or staff mock data/copy remains in dashboard code or i18n.
- [ ] Pending rows reopen the existing sale entry workflow; paid rows follow the existing sale/receipt destination.
- [ ] Loading, empty, and error states do not shift the dashboard layout.

**Verification:** Navigation/state tests and a repository text search confirm obsolete dashboard keys and mock arrays are gone.

**Dependencies:** Tasks 2–3. **Estimated scope:** Small–Medium (2–4 files).

### Task 6: Bilingual, accessibility, and regression pass

**Description:** Finish English/Thai copy and verify the complete dashboard without changing the global navigation structure.

**Acceptance criteria:**

- [ ] English/Thai translation keys have exact parity and dynamic values use preference formatters.
- [ ] Refresh and drill-through actions are keyboard accessible with visible focus and descriptive labels.
- [ ] Loading, empty, error, and stale-data states are understandable without relying on color alone.

**Verification:** i18n tests, lightweight repository checks, and manual browser verification if available. Run repository npm commands only after explicit user authorization.

**Dependencies:** Tasks 3–5. **Estimated scope:** Small (1–3 files).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dashboard totals disagree with Reports | High | Share calculation helpers and add reconciliation tests for the same date. |
| Partial-day comparisons look artificially poor | Medium | Compare today only with the same elapsed time yesterday. |
| Profit leaks to pharmacists | High | Shape role-specific data in the server route/repository, not only in React. |
| Stock queries make home slow | Medium | Return bounded alert rows plus aggregate counts; avoid fetching inventory pages. |
| Opening hours are blank or malformed | Low | Omit open/closed status unless both values validate. |
| Mixed pack units make “items sold” misleading | Medium | Do not use a summed quantity KPI in the initial top strip. |

## Explicitly Out of Scope

- Supplier payment schedules, payable due dates, or accounting integration.
- Staff attendance, shifts, targets, or individual performance ranking.
- Multi-branch selection; the current schema has one primary store profile.
- New notification infrastructure.
- Category-margin analytics until a real category aggregation contract exists.
