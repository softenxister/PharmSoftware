# CW stock normalization

The source CSV uses a product row followed by optional continuation rows for larger sale units. The normalized output separates that repeating unit data from the product itself.

## Field mapping

| Source column | Normalized field | Existing Prisma destination |
| --- | --- | --- |
| `รหัสสินค้า` | `externalProductCode` | `Product.externalProductCode` (new nullable unique column) |
| `Active` | `isActive` | `Product.isActive` |
| `ชื่อสินค้า(เต็ม)` | `itemName` | `Product.itemName` |
| Brand alias extracted from `ชื่อสินค้า(เต็ม)` | `brandName` | `Product.brandName`; unmatched names use `Unspecified` instead of copying the item name |
| `หน่วยฐาน` | `baseUnit` | `Product.packUnit` and `Product.childUnit` with `childQuantity = 1` |
| Base-unit `บาร์โค้ด` | `baseBarcode` | `Product.barcode` |
| Other-unit `บาร์โค้ด` | `barcodes[]` | First barcode maps to `ProductParentPack.barcode`; additional values map to `ProductBarcodeAlias` |
| `หน่วยสินค้า` / `[n]` | `quantityInBaseUnit` | `ProductParentPack.childPackQuantity` and current `priceMultiplier` |
| Base-unit `ราคาปลีก 1` | `baseSellPriceThb` | Synthetic `ProductBatch.sellPriceThb` |
| Other-unit `ราคาปลีก 1` | `sellPriceThb` | `ProductParentPack.sellPriceThb` |
| `จำนวนคงเหลือ` | `availableStock` | Synthetic `ProductBatch.availableStock`, measured in base units |
| `กลุ่มสินค้า` | `category` | `Category.name` |
| `บริษัทผลิต` | `manufacturerName` | `Manufacturer.name`; an `SPR-...:` prefix is removed |
| `ชื่อสามัญ` | `genericName` | Preserved for ingredient reconciliation; not inserted directly |
| `กลุ่มใบอนุญาต` | `licenseGroup` | Preserved in output; no current destination column |
| `ราคาทุนรับหลังสุด` | `lastCostThb` | Preserved in output; current cost is derived from purchase lines |

## Unit rule

Exactly one unit must match `หน่วยฐาน` and have quantity `1`. It becomes the product base unit. Every other unit becomes a parent pack whose quantity is measured in base units.

Example: when `หน่วยฐาน = ซอง`, `กล่อง[24]` means `1 กล่อง = 24 ซอง`. The display value is normalized to `กล่อง[24] : <barcode>`.

The number inside brackets must agree with `หน่วยสินค้า`. A mismatch stops normalization instead of silently importing incorrect stock conversions.

## Brand extraction

Brand extraction uses a conservative Thai/English alias registry first, followed by a cleaned leading-token suggestion. Approved aliases such as `ไทยนคร`, `thainakorn`, and `thai nakorn` map to one canonical brand. Generic packaging terms such as `(Box)`, `3D`, and `MASK` are ignored. Rows without a reliable match are marked for review and import as `Unspecified`; the full product name is never copied into `brandName`.

## Generated files

- `normalized_products.csv`: one row per product, including a combined barcode display column.
- `normalized_product_units.csv`: one row per product/unit relation.
- `prisma_import_preview.json`: the proposed `Product`, `ProductParentPack`, and synthetic `ProductBatch` records without writing to the database.
- `normalization_report.json`: counts and limitations found during conversion.

Run the converter with:

```bash
node --import tsx scripts/data-maintenance/normalize-cw-stock.ts /path/to/source.csv data/outputs/cw-stock-normalized
```

The preview deliberately does not write to PostgreSQL. The operational schema supports multiple barcodes through `ProductBarcodeAlias`, independent parent-unit prices through `ProductParentPack.sellPriceThb`, and same-name unit variants through the unique combination of product, unit name, and base-unit quantity.
