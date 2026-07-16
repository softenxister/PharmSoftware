# Implementation Plan: Ingredient Composition and Member Allergy Warnings

## Overview

Land the feature in database-first vertical slices while preserving existing member, stock, and sales contracts. Composition data is local at checkout; external enrichment is asynchronous and provenance-aware.

## Architecture Decisions

- Normalize ingredients into stable records and use join tables for product composition and customer allergies.
- Store composition status on each product so unresolved/non-medicine states are explicit.
- Keep regulator/provider lookup behind a server-only provider interface with fixed HTTPS hosts and strict timeouts.
- Seed known catalog medicines from curated authoritative records; the background worker handles future products.
- Match warnings by ingredient ID and include ingredient display names in API responses.

## Task List

### Phase 1: Persistence foundation

- [x] Add ingredient, product ingredient, and customer allergy models plus product composition status.
- [x] Add migration and curated existing-catalog composition seed.
- [x] Regenerate Prisma client and verify schema output.

### Checkpoint: Persistence

- [x] Prisma generation succeeds.
- [x] `git diff --check` succeeds.

### Phase 2: Contracts and enrichment

- [x] Extend catalog/member repository output with active ingredients and allergies.
- [x] Add authenticated ingredient search API and allergy-aware member PATCH validation.
- [x] Add Thai FDA-first official-source enrichment providers and standalone worker registration.
- [x] Register all new API paths in the Hono API registry.

### Checkpoint: Contracts

- [x] Existing API registry contract passes.
- [x] External payloads fail closed when incomplete or ambiguous.

### Phase 3: Counter workflows

- [x] Add searchable standardized allergy selection and detail display to member profile.
- [x] Add persistent matched-ingredient warnings to sales search, editor, and cart.
- [x] Add localized labels and dense pharmacy-theme styling.

### Checkpoint: Complete

- [x] Type checking succeeds without npm.
- [x] Focused checks pass without TDD.
- [x] Chrome DevTools is unavailable in this session; report that visual browser verification was not performed.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| External record matches the wrong product | High | Accept only unambiguous matches; store provenance; leave ambiguous products unresolved. |
| Ingredient synonyms miss an allergy | High | Normalize to stable ingredient IDs and retain aliases/source identifiers. |
| External service is unavailable | Medium | Store local data, use timeouts, keep pending status, and retry later. |
| Existing dirty worktree overlaps member/sales files | Medium | Make focused patches and inspect every overlapping diff region. |

## Open Questions

None.
