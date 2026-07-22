# Pharmacy Retail

This context describes customers, members, and distributors participating in pharmacy retail operations.

## Language

**Customer**:
A person or organization that purchases from the pharmacy, whether or not enrolled as a member.

**Member**:
A customer enrolled in the pharmacy's membership program.
_Avoid_: Active customer

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
