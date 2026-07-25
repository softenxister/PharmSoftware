# Brave Product Image Search

## Objective

Add an owner-operated image discovery action to the existing Product Image Review
screen. The action uses Brave Image Search to find one candidate image for each
eligible product and always places that candidate in the review queue. It never
publishes an image automatically.

This specification records the behavior approved in the `interview-me` session on
2026-07-24.

## Approved Behavior

- Only active products with total stock from 1 through 199 are eligible.
- Eligible products are processed by total stock descending, with a stable product
  ID tie-breaker.
- Products with zero stock or stock of 200 or more are excluded.
- Products that already have a real image are excluded. A generated
  `/api/product-images/{id}` placeholder is not a real image.
- A product already attempted successfully by Brave is not queried again:
  - a saved Brave candidate records a successful match;
  - a successful response with no result records an unresolved marker.
- One Brave request is made for each selected product.
- The query is the product barcode followed by the item name:
  `{barcode} {item name}`.
- Each request asks for one result. Only the first result is considered.
- A match is saved as a review candidate and cannot auto-publish.
- A successful response with no usable result marks the product unresolved and
  processing continues.
- A failed request is not retried within the same manual run. It may become eligible
  for a later run after a retry delay.
- The UI previews the eligible count and caps one manual run at 1,000 products.
- The Brave API key is read only from `BRAVE_SEARCH_API_KEY` on the server.

## Out of Scope

- Automatic or scheduled Brave runs.
- Replacing existing real product images.
- Inspecting a second image result.
- Alternate or fallback queries.
- Automatically approving or publishing Brave results.
- Saving the API key in source control, browser storage, API responses, or logs.

## Brave API Contract

- Endpoint: `GET https://api.search.brave.com/res/v1/images/search`
- Authentication: `X-Subscription-Token` request header.
- Query parameters:
  - `q`: whitespace-normalized barcode and item name;
  - `count=1`;
  - `safesearch=strict`;
  - `spellcheck=false`, so Brave does not alter the barcode/name query.
- Candidate image: the first result's Brave-hosted `thumbnail.src`.
- Source page: the first result's `url`.
- Allowed candidate image host: `imgs.search.brave.com`.
- Requests use a bounded timeout and bounded response parsing.
- Rate-limit response headers may be returned to the owner as parsed numeric
  metadata. The API key and arbitrary upstream response bodies must not be exposed.

Brave does not grant a reuse license for indexed images. Each queued candidate must
display a source-rights warning and require manual approval.

## Data And State

No schema migration is required.

- A result is stored in the existing `ProductImageCandidate` table with provider
  `BRAVE_IMAGE_SEARCH`.
- The candidate stores the Brave thumbnail URL, source page URL, the queried
  barcode, result title, and a source-rights warning.
- Evidence always records `autoPublishEligible: false` and decision `REVIEW`.
- A no-result response updates the product image state to `UNRESOLVED` with a
  deterministic Brave no-result marker.
- A request error records a bounded generic error and a future retry time, preventing
  the same product from being selected again during that run.
- Approval and preview select an image-host allowlist according to the candidate's
  provider. Existing Open Products Facts candidates continue to use their current
  allowlist.

## API

Add an owner-only route at `/api/product-image-jobs/brave`.

- `GET` returns:
  - whether the server key is configured;
  - current eligible count;
  - maximum products per run (`1000`).
- `POST` accepts `{ "limit": number }`, where `limit` is an integer from 1 to 1000.
- `POST` returns counts for selected/queried, queued, unresolved, and failed products,
  plus the remaining eligible count and any safe rate-limit metadata.
- Missing owner authorization returns the existing forbidden response.
- A missing server API key prevents the run without disclosing configuration details.
- Only one Brave run may execute in a server process at a time.

## UI

In the existing Product Image Review panel:

- Show the count of eligible active products and explain the 1–199 stock range and
  highest-stock-first order.
- Add a `Find images with Brave` button.
- Disable the action when the key is not configured, no products are eligible, or a
  run is in progress.
- One click requests `min(eligible count, 1000)` products.
- While running, present a clear busy state and an accessible live status.
- After completion, report the queried, queued, unresolved, and failed counts, then
  reload both the review queue and eligible count.
- Keep the current dense desktop/tablet pharmacy styling and stable layout.

## Security Boundaries

- **Credential theft:** the API key remains in a server-only environment variable and
  is never logged, serialized, or sent to the browser.
- **Quota abuse:** owner authorization, an integer input limit, a 1,000-product cap,
  one result per query, and an in-process run lock constrain usage.
- **SSRF:** only HTTPS Brave proxy image URLs on the fixed
  `imgs.search.brave.com` host can be previewed or approved.
- **Untrusted response data:** response fields are type-checked, length-bounded, and
  rendered through React text nodes.
- **Resource exhaustion:** requests have timeouts and the job uses bounded
  concurrency.
- **Licensing:** results are review-only and carry a source-rights warning.

## Project Structure

- `src/server/product-images/providers/braveImageSearch.ts`: provider request and
  response parsing.
- `src/server/product-images/braveJobContract.ts`: request limit parsing.
- `src/server/product-images/repository.ts`: eligibility query, state persistence,
  run orchestration, and provider-specific image-host resolution.
- `src/app/api/product-image-jobs/brave/route.ts`: owner-only GET/POST API.
- `server/apiRegistry.ts`: explicit route registration.
- `src/app/settings/ProductImageReviewPanel.tsx`: manual action and summary.
- `src/app/settings/Settings.module.css`: dense, stable action layout.
- `src/app/i18n.ts`: English and Thai labels.

## Implementation Sequence

1. Add unit tests for exact query construction, first-result parsing, hostile response
   rejection, and API input bounds.
2. Implement the provider and request contract.
3. Add repository eligibility/count/run functions and tests for stock ordering and
   image exclusions.
4. Add the owner-only API and route-registry/authentication tests.
5. Add the review-panel UI and pure UI-state tests.
6. Run focused tests, TypeScript checking, `git diff --check`, and browser validation
   when the isolated browser is available.

## Commands

Project instructions prohibit npm commands unless explicitly requested. Verification
uses direct local binaries:

```text
node --env-file-if-exists=.env --import tsx --test <focused test files>
./node_modules/.bin/tsc --noEmit
git diff --check
```

No live Brave request is part of automated verification. Provider tests use a mocked
fetch implementation.

## Success Criteria

- The UI accurately previews eligible products and starts an owner-only manual run.
- Products are selected in stock-descending order within the 1–199 range.
- Existing real images, zero stock, stock at least 200, and prior successful Brave
  attempts are skipped.
- Each selected product causes at most one request with one result requested.
- Only the first valid result is queued and never auto-published.
- No result does not block later products.
- The server never exposes the API key.
- Existing Open Products Facts review behavior remains functional.
- Focused tests pass and edited files pass `git diff --check`.

## Open Questions

None. The behavior above was explicitly confirmed by the user.
