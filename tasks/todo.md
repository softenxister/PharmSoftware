# CW Stock Import Modes Checklist

- [ ] Add `Product.migrationGenericName` and its migration.
- [ ] Persist columns G and I during full stock import.
- [ ] Add focused parser for C (`รหัสสินค้า`), G (`ชื่อสามัญ`), and I (`ราคาทุนรับหลังสุด`).
- [ ] Add exact-product-code preview statuses and old → new G/I values.
- [ ] Implement isolated batch update that writes only G/I fields.
- [ ] Add metadata-import audit records without creating stock adjustments.
- [ ] Add explicit `full` / `generic-cost-update` mode to client, API, token, and repository contracts.
- [ ] Add one uploader with two mode choices and mode-specific confirmations.
- [ ] Add regression tests proving focused updates preserve identity, barcodes, packaging, prices, stock, and verified ingredients.
- [ ] Update CW operator documentation.
- [ ] Run lightweight checks and obtain authorization before any repository npm test/build commands.

## Home Dashboard Refresh

- [ ] Define tested Bangkok-day, elapsed-period, KPI, stock-alert, and role-visibility calculations.
- [ ] Add one authenticated `/api/dashboard` endpoint with a bounded, role-aware response.
- [ ] Reconcile dashboard sales totals with the existing daily sales report.
- [ ] Reconcile low/out-of-stock and expiry counts with stock inventory filters.
- [ ] Replace the hardcoded home header and KPI cards with real data and stable states.
- [ ] Use top cards for net sales, paid bills/member share, average bill, and stock attention.
- [ ] Connect the hourly sales chart and owner-only financial context to real data.
- [ ] Add a stock-attention queue with filtered `/stock` drill-through links.
- [ ] Replace Need to Pay, Staff Overview, and Top Member Purchase with recent sales.
- [ ] Make pending recent-sale rows reopen the existing sale workflow.
- [ ] Remove obsolete dashboard mock arrays and English/Thai translation keys.
- [ ] Verify bilingual parity, permissions, accessibility, and 768/1024/1440 px layout.
