# Thailand pharmacy reports and Excel exports

Accessed: 2026-08-10  
Scope: community/retail pharmacy software in Thailand. This is product research, not legal advice; licence conditions and provincial filing instructions should be confirmed before production filing.

## Recommended `/reports` structure

### 1. Regulatory drug records — highest priority

These are confirmed requirements for a licensed modern-drug seller under the Ministerial Regulation on licensing the sale of modern drugs B.E. 2556 (2013). The current Thai FDA form index still marks ข.ย.9–14 as **Enforce** (updated 9 May 2024). Build the Excel export to reproduce the official form headings and order, not merely a generic sales spreadsheet. Sources: [Royal Gazette regulation](https://ratchakitcha.soc.go.th/documents/1995098.pdf) and [Thai FDA Drug Division forms index](https://drug.fda.moph.go.th/information-licensing-lic/category/lic6?page=2).

| Report | Confirmed legal purpose | Cadence / retention | Excel design |
|---|---|---|---|
| **ข.ย.9 บัญชีการซื้อยา** | Record every drug purchase, including date, seller, drug, lot/batch and quantity. | Keep at least 3 years from purchase. | One row per received drug/lot; supplier, invoice/ref., batch, expiry, quantity, pharmacist sign-off. |
| **ข.ย.10 บัญชีขายยาควบคุมพิเศษ** | Record each sale of a specially controlled drug. | Keep at least 3 years. | One row per dispensing event with official fields, batch and pharmacist sign-off. |
| **ข.ย.11 บัญชีการขายยาอันตรายเฉพาะรายการ** | Record each sale of dangerous drugs only for the list specified by the FDA Secretary-General. | Keep at least 3 years. | Apply a maintained regulatory drug-list flag; do not treat every dangerous drug as automatically within this form. |
| **ข.ย.12 บัญชีการขายยาตามใบสั่งยา** | Record prescription sales, including patient name/age/address, prescriber identity/address/workplace, medicine, quantity and date. | Keep the prescription at least 1 year and the account at least 3 years. | Restricted export containing patient and prescriber data; include prescription reference and pharmacist sign-off. |
| **ข.ย.13 รายงานการขายยาตามประเภทที่กำหนด** | Report sales for drug categories specified by the FDA Secretary-General. | Four-month periods; submit within 30 days after period-end, unless FDA requires earlier. | Period summary, validation, signer, due date, submission status/date/reference; exact official column order. |

The regulation also requires the pharmacist to control the correctness of and sign the accounts/reports. Therefore, exports should include preparer, reviewing pharmacist, licence number, signed/locked status, generated time and immutable audit reference. Do not label an unsigned workbook “ready to submit.”

### 2. Psychotropic and narcotic reports — show only when authorised activity applies

Do not mix these into ข.ย.9–13. Add a licence/profile-gated **Controlled substances** section using the FDA Narcotics Control Division’s current forms, including psychotropic categories 3/4 purchase/sale/prescription/monthly forms and the monthly form for narcotic category 3 / psychotropic categories 3–4 exempt activities. Source: [FDA controlled-substance forms](https://narcotic.fda.moph.go.th/for-entrepreneur/form-psychotropic-substances).

An FDA guidance page dated 9 January 2025 describes monthly reporting within one month after month-end and two-year retention at the licensed premises for the relevant controlled-substance accounts/reports. It is written for healthcare facilities, so its exact forms must **not** be applied blindly to an ordinary retail pharmacy; select forms from the pharmacy's licence/activity and confirm the FDA or provincial filing route. Sources: [FDA monthly reporting guidance](https://narcotic.fda.moph.go.th/for-entrepreneur/%20report-hp-68), [FDA current notification/regulation index](https://narcotic.fda.moph.go.th/law-type/category/notification-regulations-fda), and [FDA possession-account/report notice page](https://narcotic.fda.moph.go.th/law-type/ph-65).

Recommended controlled-substance export columns: opening balance, receipts, dispensing/sales, adjustments, closing balance, lot/batch, transaction timestamp, party/patient/prescriber identifiers required by the applicable form, pharmacist and licence, sign-off, filing period, due date, submitted date and acknowledgement/reference.

### 3. Tax and accounting reports

For a VAT-registered pharmacy, confirmed statutory reports are **input tax**, **output tax**, and **goods/raw-material inventory**, plus tax invoices and supporting documents. The Revenue Department describes these as duties of a VAT registrant, and Revenue Code sections 87 and 87/3 govern the reports and retention. Keep VAT reports, tax invoices/copies and supporting evidence at least five years at the required establishment/location; electronic storage must meet the Revenue Department's reliable-method rules. Sources: [Revenue Department — duties of VAT registrants](https://www.rd.go.th/7051.html), [Revenue Code VAT chapter](https://www.rd.go.th/2596.html), [official ruling on five-year VAT-document retention](https://www.rd.go.th/25480.html), and [Revenue Department electronic-record order ป.121/2545](https://www.rd.go.th/13502.html).

Recommended Excel exports:

- Output tax report, input tax report, goods/inventory report, and a ภ.พ.30 preparation summary by tax month and branch.
- Tax invoice register with invoice/credit-note/debit-note numbers, taxpayer/branch data, taxable amount, VAT, cancellation/replacement status and source-document link.
- A locked period snapshot and reconciliation from sales/purchases to VAT reports. Excel is a working/export format; it should not replace compliant source records or required tax invoices.

### 4. Operational reports — recommended, not identified here as statutory filings

Clearly label these **Management reports**, separate from **Regulatory reports**:

- Sales, gross profit and discount by day/month, branch, cashier, product and category.
- Inventory on hand and valuation; movement ledger by lot; stock count variance and adjustments.
- Expiry/near-expiry, damaged/quarantined/returned stock and FEFO risk.
- Reorder/stockout, slow-moving/dead stock and supplier purchasing/performance.
- Lot traceability and recall report: supplier receipt → current balance → every sale/return.
- Prescription volume and pharmacist workload, using aggregates by default.
- Audit exceptions: negative stock, back-dated edits, voids/refunds, unusual discounts, missing batch/expiry, unsigned regulatory entries and overdue submissions.

## Personal-data constraints on Excel exports

Patient identity plus prescriptions/dispensed medicines can reveal **health data**, which is sensitive personal data under PDPA section 26. The Act also requires purpose limitation/data minimisation (section 22), notice (section 23), a lawful basis for collection/use/disclosure (sections 24, 26 and 27), security and deletion/retention controls (section 37), and records of processing activities (section 39). Source: [Personal Data Protection Act B.E. 2562 — official Government PRD copy](https://law.prd.go.th/th/content/category/detail/id/2475/iid/234607).

Consequently, Excel export should enforce:

- Role-based permissions: only authorised pharmacy staff can export identifiable ข.ย.12 or controlled-substance data.
- Default minimisation: operational exports use aggregates or pseudonymous customer IDs; names, address, phone, national ID, diagnosis/allergy and prescription data are off unless the report legally needs them.
- Purpose and scope confirmation before export, including branch, date range and recipient; record exporter, timestamp, filters, purpose and file fingerprint in an audit log/RoPA linkage.
- Encryption/password-protected delivery, short-lived downloads, no email/share-link by default, visible sensitivity label, and a retention/secure-deletion date.
- Separate statutory retention from convenience copies: retain only what the governing law requires, then restrict or securely dispose of redundant exports.
- Never rely on “Excel export available” as consent. Consent or another applicable legal basis must be determined for the actual collection/use/disclosure; external sharing and cross-border cloud destinations require separate review.

## Suggested release order

1. ข.ย.9–13 exact-form views and Excel, pharmacist sign-off, due/retention status.
2. VAT input/output/inventory reports and ภ.พ.30 reconciliation.
3. Lot/expiry/recall, stock valuation and sales/margin management reports.
4. Licence-gated narcotic/psychotropic forms after confirming the target pharmacy authorisations and filing route.
5. Advanced audit, supplier and workload dashboards.

