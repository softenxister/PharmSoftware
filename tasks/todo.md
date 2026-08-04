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
