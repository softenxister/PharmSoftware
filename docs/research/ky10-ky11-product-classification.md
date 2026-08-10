# Determining whether a pharmacy product belongs in ข.ย.10 or ข.ย.11

Accessed: 2026-08-10  
Scope: retail/community pharmacies selling modern drugs in Thailand. This is implementation research, not legal advice; ambiguous products and filing decisions should be confirmed by the responsible pharmacist and, where necessary, the provincial public-health office or Thai FDA.

## Short answer

Use the product's **exact Thai FDA drug registration number** to resolve the registered product, then read its current **legal category** (`ประเภทของยาควบคุมตามกฎหมาย`) and exact composition, dosage form, route and strength:

- **ยาควบคุมพิเศษ (specially controlled drug)** → record every sale in **ข.ย.10**.
- **ยาอันตราย (dangerous drug)** → record it in **ข.ย.11 only if** it also matches the separate FDA Secretary-General designation described below.
- A drug that is neither category is in neither report. Narcotics and psychotropic substances follow separate regimes.

This distinction is explicit in clause 8(6) and 8(7) of the Ministerial Regulation on licences to sell modern drugs B.E. 2556: ข.ย.10 covers sales of specially controlled drugs, while ข.ย.11 covers only the dangerous-drug items designated by the FDA Secretary-General. It is therefore wrong to put every dangerous drug in ข.ย.11. Source: [Royal Gazette — Ministerial Regulation B.E. 2556](https://ratchakitcha.soc.go.th/documents/1995098.pdf). The FDA continues to mark both official forms as enforced: [ข.ย.10](https://drug.fda.moph.go.th/information-licensing-lic/lic6.13/) and [ข.ย.11](https://drug.fda.moph.go.th/information-licensing-lic/lic6.14/).

## Current ข.ย.11 designation

The Thai FDA's enforced announcement dated **14 July 2015 (B.E. 2558)**, *รายการยาอันตรายที่ต้องทำบัญชีการขายยา*, designates:

1. **Tramadol** — single-ingredient and combination products, all dosage forms.
2. **Dextromethorphan** — single-ingredient and combination products, all dosage forms.
3. The following **11 antihistamines, only when the product is a liquid dosage form**, whether single-ingredient or combination:
   - Brompheniramine
   - Carbinoxamine
   - Chlorpheniramine
   - Cyproheptadine
   - Dexchlorpheniramine
   - Dimenhydrinate
   - Diphenhydramine
   - Doxylamine
   - Hydroxyzine
   - Promethazine
   - Triprolidine

The announcement is listed as **Enforce** in the FDA's official modern-drug sales notices: [FDA announcement page and PDF](https://drug.fda.moph.go.th/announcement-administration/75-fda-2015071475) and [FDA notices index](https://drug.fda.moph.go.th/announcement-administration/category/selling-modern).

### Important tramadol change

The Ministry subsequently classified **single-ingredient oral tramadol** as a specially controlled drug in announcement No. 57, published in the Royal Gazette on 14 July 2025 and effective after its 180-day transition period. As of the access date it therefore belongs in **ข.ย.10**, not ข.ย.11. Other tramadol products must be decided from their current product-level legal category: if the FDA record still classifies the exact product as dangerous and it matches the 2015 designation, it remains a ข.ย.11 product. Sources: [FDA consolidated specially controlled list](https://drug.fda.moph.go.th/announcement-ministry/53spc/) and [announcement No. 57 PDF](https://drug.fda.moph.go.th/media.php?id=785662916186742784&name=ratchakitcha_spc-tramadol57.pdf).

## Authoritative lookup and matching method

The registration number is the correct product master key, but the characters in the number do **not themselves encode** ข.ย.10 or ข.ย.11. Use it to find the exact registered product and then evaluate the returned fields and the effective legal notices.

1. Capture the Thai FDA registration number from the package or supplier master data; retain the printed value and a normalized search value.
2. Search the official [FDA medicinal-product search](https://pertento.fda.moph.go.th/fda_search_drug/SEARCH_DRUG/FRM_SEARCH_DRUG.aspx). Verify registration status, trade name, licence holder, active ingredients, dose form, route/point of use, strength, and **Category by legislation class**. A product detail page exposes the category directly; for example, the FDA shows a registered product with `ยาควบคุมพิเศษ` on its product record: [official example](https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug_ex.aspx?Newcode=U1DR1C1012580006011C).
3. If the category is specially controlled, set `report_ky10 = true` and `report_ky11 = false`.
4. If the category is dangerous, match the exact ingredients **and** the announcement's form/route/strength conditions. For the 2015 ข.ย.11 rule, set `report_ky11 = true` only for the products listed above.
5. If neither rule matches, set both flags false. Send missing, conflicting, cancelled, unregistered or unclear records to pharmacist review; never infer from barcode, trade name or ingredient name alone.
6. Store an audit snapshot: registration number, category, composition/form/route/strength, matched notice and clause, notice effective date, FDA record update/check time, reviewer and decision date. Re-evaluate when a registration or legal rule changes.

For cross-checking the rules themselves, use the FDA's [consolidated specially controlled-drug list](https://drug.fda.moph.go.th/announcement-ministry/53spc/) and [consolidated dangerous-drug list](https://drug.fda.moph.go.th/announcement-ministry/category/dangerous-drugs). Both contain formulation, route and other exceptions and link to the amending notices. The FDA's RIM-Phar master vocabulary identifies `TRDL-0002` as dangerous drug and `TRDL-0003` as specially controlled drug: [standard terms, item 13](https://drug.fda.moph.go.th/standardterms/).

## Data/API assessment

- Public NDI search accepts trade name, generic name and registration number and exposes composition/form/strength in its results: [National Drug Information](https://ndi.fda.moph.go.th/index.php/). However, the public result tested did not expose the legal-category field, and its deeper detail path can require login. NDI alone is therefore insufficient to make the ข.ย.10/ข.ย.11 decision.
- The separate FDA product-search detail page does expose `Category by legislation class`, but no documented, supported bulk product-classification API or downloadable product-to-TRDL mapping was found in the official public interfaces reviewed. Its ASP.NET page endpoints should not be treated as a stable production API without written FDA permission/support.
- A safe production integration should obtain an authorised FDA dataset/API or maintain a pharmacist-reviewed, effective-dated classification table keyed by registration number. The public UI can support onboarding and exception verification, not silent unattended compliance decisions.

## Gap in the current application

The current product model does not yet provide enough verified, effective-dated regulatory data to generate reliable ข.ย.10/ข.ย.11 reports. It needs, at minimum:

- canonical Thai FDA registration number and current registration status;
- legal category code and source/check date;
- normalized active ingredients, formulation, route and strength;
- effective-dated rule matches for ข.ย.10 and ข.ย.11, including source notice/version;
- pharmacist verification, override reason and audit history.

Do not add a permanent manual checkbox called only `ข.ย.11`. The legal category and designation can change, as the tramadol transition demonstrates. Classification should be recomputable from versioned source facts, with an explicit reviewed override for exceptions.

Finally, a ข.ย.10 or ข.ย.11 classification does not exclude other obligations: the same dispensing event may also require prescription, category report, or track-and-trace handling under another rule.
