# Pharmacy Retail

This context describes customers, members, and distributors participating in pharmacy retail operations.

## Language

**Customer**:
A person or organization that purchases from the pharmacy, whether or not enrolled as a member.

**Member**:
A customer enrolled in the pharmacy's membership program.
_Avoid_: Active customer

**Membership Rank**:
A Member loyalty tier determined by accumulated Loyalty Points: Bronze 0–100, Silver 101–500, Gold 501–2,000, Platinum 2,001–10,000, and Diamond above 10,000.
_Avoid_: Regular rank

**Loyalty Point**:
A whole-number reward unit earned by a Member from a paid sale at one point per ฿10 of net payable; an incomplete ฿10 does not earn a point.
_Avoid_: Partial point, pending-sale point

**Member Code**:
The pharmacy-issued business identifier for a member, distinct from the internal customer ID and any barcode.
_Avoid_: Barcode, customer ID

**Membership Start Date**:
The date a customer first became a pharmacy member.
_Avoid_: Import date

**Customer Address**:
An optional postal or contact address associated with a customer.

**Member Phone Numbers**:
One or more Thai contact numbers associated with a member. Phone numbers are contact data, not member identity, and may be shared by multiple members.
_Avoid_: Member identifier

**Distributor**:
A company or organization that supplies purchased stock to the pharmacy.
_Avoid_: Manufacturer

**Distributor Code**:
The CW-issued business identifier for a distributor, distinct from its internal database ID and display name.
_Avoid_: Distributor name, internal ID

**Product Category**:
The single broad retail-use group used to find and organize a product in stock. It is distinct from regulatory status and detailed pharmacological classification.
_Avoid_: Regulatory category, drug schedule

**Regulatory Status**:
A legal control or sale classification such as household medicine, dangerous drug, or specially controlled drug. It is not a product category.
_Avoid_: Product category

**Regulatory Record**:
A legally prescribed pharmacy purchase or sales ledger, including ข.ย.9, ข.ย.10, and ข.ย.11. A Product may require more than one Regulatory Record.
_Avoid_: Regulatory Status, drug category

**Fallback Category**:
The broad “Other Medicines & Health Products” group reserved for products whose primary retail use cannot be determined from reliable catalog evidence.
_Avoid_: Uncategorized

**Sale**:
A pharmacy transaction containing products supplied to a Customer, covering its lifecycle from pending payment through paid completion.
_Avoid_: Checkout, order

**Checkout**:
The payment step that transitions a valid Sale to paid completion.
_Avoid_: Sale, save

**Purchase**:
A Distributor bill lifecycle covering draft entry, partial receipt, full receipt, and later correction.
_Avoid_: Receiving, stock intake

**Receiving**:
The step in a Purchase that increases available Stock from accepted purchased quantities.
_Avoid_: Purchase, purchase entry

**Product**:
A retail catalog item identified by its name, barcodes, packaging, manufacturer, and Product Category.
_Avoid_: Stock, batch

**Dosage Form**:
The single primary physical form in which a Product is presented for administration: Tablet, Capsule, Powder, Syrup, Suspension, Solution, Drops, Cream, Ointment, Gel, Lotion, Spray, Inhaler, Injection, Suppository, or Patch. It is distinct from measurement and packaging units.
_Avoid_: Dosage Type, child unit, package unit

**Stock**:
The available quantity of a Product, tracked by batch and expiry where applicable.
_Avoid_: Product, inventory screen

**Inventory**:
The operational view that combines Product information with current Stock for pharmacy staff.
_Avoid_: Product catalog, Stock quantity
