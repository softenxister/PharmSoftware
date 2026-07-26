# Official sources for Thai pharmacy brand normalization

Checked on 2026-07-21.

## Conclusion

There is no authoritative, downloadable source containing every brand that may appear in a Thai drugstore. The official records are split by regulatory domain, and an official "trade name" is not always the same thing as a customer-facing brand. A maintainable dictionary therefore needs several sources plus reviewed corrections from actual imports.

The strongest starting point is:

1. TMT for modern medicines.
2. TTMT for traditional Thai medicines.
3. Thai FDA product records to validate Thai/English trade-name pairs.
4. GS1 data for barcode-linked consumer products, subject to its access limits.
5. Human-reviewed aliases learned from pharmacy imports for products and brand families not represented cleanly by those registries.

Do not treat a licensee or manufacturer as the brand. For example, `ไทยนครพัฒนา / Thai Nakorn Pattana` can be the manufacturer or licensee while the product itself has a different trade name. Store `brand`, `trade product name`, `manufacturer`, and `licensee` separately.

## Source assessment

| Source | What it provides | Access | Important limitations |
| --- | --- | --- | --- |
| [Thai Medicines Terminology (TMT)](https://this.or.th/service/tmt/about/) | Standard medicine concepts covering trade name, generic name, dose form, strength, unit, pack size, manufacturer, and relationships between product levels. | Versioned ZIP releases from the [official download page](https://this.or.th/service/tmt/download/); login is required. The [HSRI catalog API record](https://opendata.hsri.or.th/api/3/action/package_show?id=e85ad683-f5c5-4831-983a-1e6d077efe16) labels the dataset Thai/English and `Open Data Common`. | Best bulk source for modern drugs, but the Fully Specified Name is a composed product description rather than a clean brand-alias table. It does not cover masks, cosmetics, food supplements, and other general merchandise comprehensively. |
| [Traditional Thai Medicines Terminology (TTMT)](https://this.or.th/service/ttmt/) | Registered traditional Thai medicine terminology supplied through the Thai traditional-medicine authority. | Versioned release files; login is required. The [HSRI catalog API record](https://opendata.hsri.or.th/api/3/action/package_show?id=herbal-medicine) describes CSV, Thai-language, `Open Data Common` data. | The best official bulk source for Thai traditional remedies, but it is not a complete consumer-brand registry. Thai-to-English aliases may still require FDA validation or manual review. |
| [Thai FDA public pharmaceutical information](https://pertento.fda.moph.go.th/FDA_INFORMATION_DRUG/Home/Public_Information_Drug_Human) and [drug search](https://pertento.fda.moph.go.th/fda_search_drug/SEARCH_DRUG/FRM_SEARCH_DRUG.aspx) | Thai and English trade names, registration number, status, approval date, licensee, dosage form, ingredients, manufacturer, and other regulatory details. | Public interactive web search and individual product pages. | There is no documented, supported bulk API or download for the complete registry. The search page says its results are for preliminary checking and directs users to the Drug Division for legal reliance. |
| [Thai FDA health-product search](https://porta.fda.moph.go.th/fda_search_center_new/) | Entry point for drugs, foods, cosmetics, medical devices, herbal products, and other regulated health products. | Public interactive search. | Product types are backed by separate systems and schemas. No unified downloadable Thai/English brand master was found. |
| [Thai FDA cosmetics search](https://pertento.fda.moph.go.th/FDA_SEARCH_CENTER/PRODUCT/FRM_SEARCH_CMT_AVS.aspx) | Separate Thai/English trade-name and product-name fields for notified cosmetics. | Public interactive search and individual records. | No documented bulk cosmetic product API/download was found in the FDA catalog. |
| [GS1 Thailand Smartbar and Verified by GS1](https://gs1th.org/en/home-english/) | Barcode/GTIN-linked product and company information supplied by product owners, useful for masks and other non-drug consumer goods. | Consumer applications and [Verified by GS1](https://gs1th.org/en/service-verified-by-gs1-en/). | The public [Verified by GS1 terms](https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf) cap free public access at 30 single queries per 24 hours. It is not a public bulk feed; commercial/API terms must be arranged with GS1. Products imported into Thailand may also use a non-885 GTIN prefix. |
| [Department of Intellectual Property trademark dataset](https://catalog.ipthailand.go.th/dataset/dip_04060101) | Thai trademark applications, registration/status data, Nice classes, goods, applicants, and mark images. | The catalog describes JSON/API access through [DIP Exchange](https://exchange.ipthailand.go.th/). | The [official data dictionary](https://catalog.ipthailand.go.th/dataset/0ea5ac2b-8f6b-4566-a5e6-147c4fd7d1b3/resource/ab68ad9f-709b-4367-8b90-7a69361ffe8d/download/datadict-tm.xlsx) has the mark as a Base64 image rather than a clean trademark-name field. OCR would be required, and the catalog's `Other` license does not state reusable terms. Obtain permission before production use. |
| [Thai FDA TH IDMP implementation guide](https://pharmetheus.fda.moph.go.th/fhirig/core/en/artifacts.html) | A future-facing FHIR model for medicinal product names, trademark name parts, Thai FDA identifiers, TMT identifiers, manufacturers, and packaging. | Public specification. | The current guide is an early specification and its examples are fictional. No public production FHIR endpoint containing all registered products was found. Treat it as a target schema, not a current feed. |

## Evidence from the Thai FDA catalog

The Thai FDA publishes a supported CKAN catalog API. On the check date, [`package_search?rows=100`](https://catalog.fda.moph.go.th/api/3/action/package_search?rows=100) returned 49 datasets. The complete catalog did not contain a current, comprehensive product/trade-name master spanning medicines, cosmetics, foods, devices, and household products.

The Medicines Regulation Division organization exposed eight datasets through its [CKAN organization API](https://catalog.fda.moph.go.th/api/3/action/organization_show?id=fda-drug&include_datasets=true). They covered topics such as licensing locations, statistics, import/manufacturing value, vaccines, and a limited historical new-generic medicine list. They were not a complete brand registry. The new-generic dataset's [metadata](https://catalog.fda.moph.go.th/api/3/action/package_show?id=new-generic-drug) identifies old PDF resources and says `License not specified`.

The public drug page's own JavaScript calls an internal POST service named `SP_DATA_PRODUCT_REGISTER_NBC_NC`; see the official [controller](https://pertento.fda.moph.go.th/FDA_INFORMATION_DRUG/Scripts_angular/Public_Information_Drug_Human_CTRL.js) and [service definition](https://pertento.fda.moph.go.th/FDA_INFORMATION_DRUG/Scripts_angular/CENTER_SV.js). This is an implementation detail, not published API documentation. It must not be treated as a supported ingestion contract.

Thai FDA's [website policy](https://www.fda.moph.go.th/website-policy/) is especially important: section 3.3 prohibits automated/scripted access except through methods the FDA provides or with explicit permission, and sections 2.2 and 3.5 restrict modifying, transferring, copying, or reselling protected content without authorization. Therefore, do not scrape the interactive FDA search to manufacture a bulk dictionary. Use licensed catalog resources or obtain written permission.

## Example: what an official Thai/English pair can establish

The FDA record for [ยาธาตุน้ำขาว ตรากระต่ายบิน](https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022660008211C) pairs the Thai trade name `ยาธาตุน้ำขาว ตรากระต่ายบิน กลิ่นช็อกโกแลตมินต์` with `FLYING RABBIT MIST SALOL ET MENTHOL CHOCOLATE MINT FLAVOR`.

That record supports a reviewed alias such as:

```text
canonical brand: FLYING RABBIT
aliases: กระต่ายบิน, ตรากระต่ายบิน, flying rabbit
source: Thai FDA registration 2A 82/66
```

It does **not** mean every word in a trade name is a brand. Strength, dosage form, flavor, pack size, generic ingredient, and manufacturer terms must be removed or stored separately.

## Recommended ingestion design

Maintain provenance and confidence instead of shipping one untraceable static list:

```text
Brand
- id
- canonicalName
- canonicalNameTh
- canonicalNameEn
- status

BrandAlias
- brandId
- normalizedAlias
- displayAlias
- language
- aliasType          # official_trade_name, trademark, user_approved, manufacturer_hint
- sourceSystem       # TMT, TTMT, THAI_FDA, GS1, MANUAL
- sourceRecordId
- sourceRelease
- sourceUrl
- confidence
- reviewedAt
```

Recommended refresh process:

1. Import each new TMT/TTMT release into staging, preserving source IDs, release version, hashes, and status changes.
2. Extract candidate brand tokens from Trade Product/Trade Product Use names; do not equate the full TMT FSN with a brand.
3. Validate uncertain Thai/English pairs against individual FDA records through a human review workflow, not an automated scraper.
4. Enrich barcode-linked non-drug goods only through an authorized GS1 agreement or data supplied by distributors/import files.
5. Learn aliases from approved import corrections. Never auto-promote an unreviewed first word to a global brand.
6. Keep ambiguous names in review. The same token can be a brand, manufacturer, product line, ingredient, or packaging text depending on the record.

## Licensing summary

- TMT and TTMT are marked `Open Data Common` in the official HSRI catalog, but downloading currently requires a THIS account. Preserve attribution and provenance, and retain the license metadata with every imported release.
- Thai FDA interactive search pages are not a licensed bulk feed. The FDA website policy restricts scripted access and content reuse unless explicitly authorized.
- Individual FDA catalog datasets can have their own license metadata; several relevant FDA datasets say `License not specified`. Check each dataset before reuse.
- GS1 public verification is rate-limited and not a bulk redistribution source. Contact GS1 Thailand for commercial/API use.
- The DIP trademark API has unclear reuse terms and image-only marks; obtain written access/reuse permission before incorporating it.

