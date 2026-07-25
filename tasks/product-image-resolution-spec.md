# Spec: Verified Product Image Resolution

## Objective

Build a repeatable image-resolution system for every current and future pharmacy product.
The system prioritizes exact product identity over coverage, downloads approved images into
store-controlled Amazon S3 storage, and gives owners a permanent review queue for uncertain
candidates.

The initial backfill must evaluate all current products. A product is allowed to remain unresolved;
it must never receive a plausible but unverified image.

## Confirmed User Intent

- Process every current product and automatically enqueue every future product.
- Start with free, permitted sources. Do not scrape Watsons, Thai FDA, GS1 public lookup, or any
  other source whose terms do not permit commercial bulk reuse.
- Automatically publish only exact-identifier, conflict-free matches.
- Send uncertain candidates to an Owner-only review screen.
- Download approved originals to a private Amazon S3 bucket.
- Retain source URL, source page, provider, licence, match evidence, dimensions, checksum,
  verification time, and reviewer.
- Render unresolved products with a white-background placeholder:
  - centered bold dark-green brand name;
  - supporting text `No verified image`;
  - brand value `Invalid` when the stored brand is null, blank, or `Unspecified`;
  - no fake product, package, tablet, or branded artwork.

## Stack

- React 19.2.7 and React Router 7.18.1
- Vite 8.1.4
- Hono 4.12.30 HTTP server and existing route registry
- Prisma 7.8.0 with PostgreSQL/Neon
- Node runtime `fetch`, `crypto`, `dns`, and `net`
- Amazon S3 REST API using AWS Signature Version 4
- Existing CSS modules and pharmacy theme

No new npm dependency is required for the first implementation.

## Source Priority

1. **Authorized manufacturer/importer/distributor feed**
   - Adapter is supported when a feed is explicitly configured and reuse rights are recorded.
   - No generic manufacturer-site crawler.
2. **GS1/GDSN**
   - Adapter contract is reserved, but the free public GS1 lookup is not bulk-queried.
   - Activation requires a licensed feed later and is out of the free first run.
3. **Thai FDA**
   - Regulatory identifiers may be stored as evidence.
   - No scripted image download until written API/reuse permission exists.
4. **DailyMed**
   - Exact US NDC/SETID only.
   - Attached media is classified; it is not assumed to be a package image.
5. **Open Products Facts / Open Beauty Facts / Open Food Facts**
   - Exact normalized barcode first, using the documented product API.
   - Community images are candidates and retain CC BY-SA attribution.
6. **Name-based retrieval**
   - Used only when no usable identifier exists and a licensed candidate corpus is configured.
   - The free provider has no current supported full-text API, so v1 safely marks these products
     unresolved instead of calling its legacy search endpoint.
   - A future permissioned corpus may use deterministic Thai/English normalization and local
     embeddings to create review candidates.
   - Strength, dosage form, pack size, brand, manufacturer, and market conflicts remain hard rejects.
   - No candidate may be auto-published solely from text similarity.

## Identity and Matching Rules

### Identifier normalization

- Preserve the raw barcode.
- Remove only documented formatting separators.
- Validate UPC/EAN/GTIN check digits.
- Compare identifiers in normalized GTIN-14 form.
- Keep packaging level attached to each identifier.
- Invalid or internal barcodes do not enter exact-GTIN matching.

### Auto-publish

All conditions are required:

1. Exact normalized identifier match.
2. Candidate is the same package level and target market when those fields are available.
3. No conflict in brand, product name, active ingredient, strength, dosage form, manufacturer,
   or pack count.
4. Source permits the intended commercial display and storage.
5. Image passes URL, MIME, byte-size, dimension, and checksum validation.
6. Image is not a placeholder, collage, tracking pixel, or known duplicate for another identifier.

### Review

- Exact regulatory identity with ambiguous media role.
- Exact community barcode with incomplete hard-field evidence.
- Text candidate with every available hard field agreeing.
- Candidate remains external until approval; approval downloads it to S3.

### Reject or unresolved

- Reject on any GTIN, strength, dosage-form, pack-count, brand-owner, manufacturer, or market
  conflict.
- Unresolved when no licensed, verifiable candidate remains.
- Never invent an image URL or generate a likeness of the product.

## Data Model

### Product additions

- `imageResolutionStatus`: `PENDING | VERIFIED | REVIEW | UNRESOLVED`
- `imageCheckedAt`: nullable timestamp
- `imageRetryAt`: nullable timestamp
- `imageResolutionError`: nullable bounded string

`Product.imageUrl` remains the compatibility field returned to existing POS screens. It contains
only an internal application URL for verified assets or the internal placeholder URL. It never stores
the remote source URL or a temporary S3 signed URL.

### ProductIdentifier

- `id`, `productId`
- `type`: `GTIN | NDC | THAI_FDA_REGISTRATION | RXCUI | OTHER`
- `value`, `normalizedValue`
- `market`, `packageLevel`
- `sourceUrl`, timestamps
- unique `(type, normalizedValue, market, packageLevel)`

### ProductImageCandidate

- `id`, `productId`, `status`: `PENDING | APPROVED | REJECTED`
- `provider`, `sourcePageUrl`, `sourceImageUrl`, `sourceLicence`
- `sourceIdentifierType`, `sourceIdentifierValue`
- `sourceProductName`, `sourceBrand`, `sourceManufacturer`, `sourceMarket`
- `evidence` JSON, deterministic `score`
- `imageMimeType`, `imageWidth`, `imageHeight`, `imageByteSize`
- `rejectionReason`, `reviewedBy`, `reviewedAt`, timestamps
- uniqueness prevents the same product/provider/source image from being queued twice

### ProductImageAsset

- `id`, unique `productId`
- unique `storageKey`
- `mimeType`, `width`, `height`, `byteSize`, `sha256`
- source and licence fields copied from the approved candidate
- `matchedIdentifierType`, `matchedIdentifierValue`, `evidence`
- `verifiedAt`, `reviewedBy`, timestamps

Replacing an approved asset preserves audit history in the candidate records and replaces the
single current asset pointer transactionally.

## Storage Contract

Required server-only environment variables:

- `AWS_S3_REGION`
- `AWS_S3_BUCKET`
- `AWS_S3_ACCESS_KEY_ID`
- `AWS_S3_SECRET_ACCESS_KEY`
- optional `AWS_S3_ENDPOINT` for testing

Rules:

- Use a private bucket with S3 Block Public Access enabled.
- Use Bucket owner enforced object ownership; do not send object ACLs.
- IAM credentials receive only the bucket/object operations needed by this feature.
- Object key: `product-images/{productId}/{sha256}.{extension}`.
- Serve images through `GET /api/product-images/:productId` with cache headers.
- Credentials and signed S3 URLs are never returned to the client or written to logs/database.

AWS recommends keeping ACLs disabled with Bucket owner enforced:
https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html

## Remote Fetch Security

- Only HTTPS.
- Provider-specific hostname allowlists; no arbitrary owner-supplied fetch URL in v1.
- Resolve all DNS results and reject loopback, link-local, private, multicast, documentation, and
  reserved IPv4/IPv6 ranges.
- Reject cross-host redirects; cap same-provider redirects.
- Abort after 10 seconds.
- Maximum 8 MiB.
- Allow JPEG, PNG, WebP, and AVIF only; reject SVG and HTML.
- Verify magic bytes independently of `Content-Type`.
- Require a useful product-image resolution (minimum 600 px short edge or 800 px long edge).
- Stream with a byte cap; never buffer an unbounded response.
- Hash bytes before upload and deduplicate by checksum.

## API Contract

Every review and mutation endpoint calls the existing server-side `requireStoreOwner`.

- `GET /api/product-image-review`
  - filters: status, provider, query, cursor, page size
  - returns stable cursor pagination, counts, product identity, candidate evidence, and preview URL
- `POST /api/product-image-review/:candidateId/approve`
  - idempotently validates, downloads, uploads, activates asset, and audits reviewer
- `POST /api/product-image-review/:candidateId/reject`
  - requires a bounded reason and audits reviewer
- `POST /api/product-image-jobs/run`
  - Owner-only, bounded batch size, resumes from database state
- `GET /api/product-images/:productId`
  - authenticated pharmacy users; serves verified S3 object or generated unresolved placeholder
- `GET /api/product-image-candidates/:candidateId/preview`
  - Owner-only validated proxy for a pending external image

Errors use the existing JSON `{ error: string }` convention and appropriate HTTP status codes.
Mutation endpoints are idempotent and reject stale candidate state with `409`.

## Owner Review UI

Location: **Settings → Product Image Review**, visible only to Owner accounts.

Desktop/tablet layout:

- compact summary bar: Verified, Needs review, Unresolved, Pending;
- searchable/filterable queue with stable dimensions;
- current item identity and candidate image side by side;
- evidence list shows exact agreements, missing fields, conflicts, provider, licence, and resolution;
- Approve, Reject, and Leave unresolved actions;
- no bulk approval except exact-identifier, no-conflict candidates;
- loading, empty, error, keyboard focus, and screen-reader states;
- no layout shift when names, URLs, or evidence are long.

Normal sales, purchase, and stock workflows receive the verified internal image URL or the
brand placeholder without exposing review controls.

## Placeholder Contract

`GET /api/product-images/:productId` generates a safe SVG when no verified asset exists:

- white background;
- quiet pharmacy-green border/detail;
- brand centered in bold dark-green text;
- secondary `No verified image`;
- use `Invalid` for null, blank, or case-insensitive `Unspecified`;
- escape all XML text and cap displayed length;
- consistent fixed viewBox and dimensions;
- cache by product update timestamp/status;
- `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`;
- no remote resources, scripts, or product-like illustrations.

## Batch and Ongoing Processing

- Database migration marks all existing products `PENDING`.
- CLI batch runner processes every pending product in resumable pages.
- Provider requests are rate-limited and cached.
- A provider failure records bounded retry state and does not stop the full catalog.
- New products default to `PENDING`.
- Stock imports and manual creation need no synchronous external request; the resolver picks them up
  on the next bounded run.
- The Owner screen can run the next batch and shows progress.

The first production run is blocked until valid S3 configuration is supplied. Without S3 credentials,
the system may discover candidates but must not approve or publish remote images.

## Commands

Project rules prohibit npm commands unless explicitly requested.

- Focused tests:
  `node --env-file-if-exists=.env --import tsx --test <test-files>`
- Full existing tests:
  `node --env-file-if-exists=.env --import tsx --test server/*.test.ts src/server/auth/*.test.ts src/server/db/*.test.ts src/app/*.test.ts src/app/stock/*.test.ts src/app/settings/*.test.ts src/app/login/*.test.ts src/app/sales/new/*.test.ts src/features/events/components/navigation/*.test.ts`
- Type check:
  `./node_modules/.bin/tsc --noEmit`
- Generate Prisma client:
  `./node_modules/.bin/prisma generate`
- Apply production migration:
  `./node_modules/.bin/prisma migrate deploy`
- Batch preview:
  `node --env-file-if-exists=.env --import tsx scripts/resolve-product-images.ts --dry-run`
- Batch apply:
  `node --env-file-if-exists=.env --import tsx scripts/resolve-product-images.ts --apply`
- Diff hygiene:
  `git diff --check`

## Project Structure

- `prisma/schema.prisma` and `prisma/migrations/` — persistence
- `src/server/product-images/` — identity, matching, providers, fetch security, S3, orchestration
- `src/server/product-images/repository.ts` — transactional persistence and orchestration
- `src/app/api/product-image-*/` — HTTP handlers
- `src/app/settings/ProductImageReviewPanel.tsx` and related modules — Owner review UI
- `scripts/resolve-product-images.ts` — resumable backfill
- colocated `*.test.ts` — pure and route/repository tests
- `docs/product-image-source-research.md` — source/licence evidence

## Code Style

Use small, explicit contracts and return data rather than mutating hidden state:

```ts
export type MatchDecision =
  | { status: "verified"; evidence: MatchEvidence }
  | { status: "review"; evidence: MatchEvidence }
  | { status: "rejected"; evidence: MatchEvidence; reason: string };

export function decideProductImageMatch(
  product: ProductIdentity,
  candidate: CandidateIdentity,
): MatchDecision {
  // Hard conflicts return rejected before any score is considered.
}
```

## Testing Strategy

1. Pure unit tests:
   - GTIN normalization/check digit;
   - hard conflicts and deterministic scoring;
   - unspecified-brand placeholder behavior;
   - MIME/magic-byte and dimension parsing;
   - S3 canonical request/signature fixtures;
   - cursor/filter parsing.
2. Repository and route tests:
   - owner authorization;
   - idempotent approve/reject;
   - stale candidate conflict;
   - transactional asset replacement;
   - new products default to pending.
3. Browser verification:
   - Owner can open, filter, approve, and reject;
   - pharmacist cannot see or call review controls;
   - desktop and tablet widths;
   - accessibility tree and keyboard navigation;
   - no console errors or warnings.
4. Batch verification:
   - every product reaches a terminal `VERIFIED`, `REVIEW`, or `UNRESOLVED` state;
   - retries resume without duplicate candidates/assets.

## Boundaries

### Always

- Preserve exact package identity and evidence.
- Prefer unresolved over uncertain.
- Enforce Owner authorization on the server, not only in the UI.
- Keep S3 and provider credentials server-only.
- Rate-limit and cache provider calls.
- Keep the UI dense, stable, and suitable for desktop/tablet pharmacy counters.

### Ask first

- Add a paid source.
- Add a new dependency.
- Enable a new provider whose commercial image-reuse permission is not documented.
- Make the S3 bucket public.
- Auto-approve a class of matches broader than exact identifier plus no conflicts.

### Never

- Scrape or hotlink Watsons.
- Bulk-query the free GS1 public lookup.
- Script Thai FDA without written permission.
- Let an LLM invent a URL or override a hard mismatch.
- Fetch arbitrary URLs, private network addresses, or unbounded content.
- Store AWS secrets, signed URLs, or third-party credentials in source control or database fields.
- Use an AI-generated package/product likeness as an unresolved placeholder.

## Success Criteria

- All existing products are processed and no product remains indefinitely `PENDING`.
- New products enter `PENDING` automatically.
- Only verified S3-backed assets appear as real product images.
- Every real image is traceable to its source, licence, identifier, checksum, and verifier.
- Conflicting strength, form, pack, manufacturer, market, or identifier never auto-publishes.
- Unresolved placeholder exactly follows the confirmed brand/`Invalid` visual contract.
- Review APIs and UI are Owner-only.
- Batch runs are resumable, bounded, rate-limited, and duplicate-safe.
- Focused tests, full existing tests, type check, migration, browser verification, and
  `git diff --check` pass.

## Open Implementation Input

Before the first production upload/backfill, the user must provide an AWS account, private S3 bucket,
region, and least-privilege IAM credentials through environment variables. This is operational input,
not an unresolved product decision.

## Out of Scope

- Paid feeds in the first run.
- Unauthorized retailer or regulator scraping.
- Forced image coverage.
- Public S3 objects.
- Mobile-phone-first review UI.
- AI-generated product/package images.
- Automatic visual diagnosis or clinical pill identification.
