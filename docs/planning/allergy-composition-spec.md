# Spec: Ingredient Composition and Member Allergy Warnings

## Objective

Protect pharmacy counter staff from silently selling a medicine containing an ingredient recorded as a member allergy. Staff maintain member allergies through a searchable standardized ingredient list. Product active ingredients are populated automatically from authoritative sources and stored locally so `/sales/new` can warn immediately.

## Tech Stack

- React 19.2.7 and React Router 7.18.1 for the member and sales UI.
- Vite 8.1.4 for the client and server builds.
- Hono 4.12.30 for `/api/*` routing.
- Prisma 7.8 and PostgreSQL for normalized ingredient, composition, provenance, and allergy data.
- Thai FDA product records as the preferred authority; NLM RxNorm and FDA label/NDC data as international fallbacks.

## Commands

- Targeted tests without npm: `node --env-file-if-exists=.env --import tsx --test <test-file>`
- Type check without npm: `./node_modules/.bin/tsc --noEmit`
- Whitespace validation: `git diff --check`
- Prisma client generation without npm: `./node_modules/.bin/prisma generate`

## Project Structure

- `prisma/schema.prisma` and `prisma/migrations/` — normalized persistence and migration.
- `server/db/` — ingredient, member allergy, product composition, and catalog persistence.
- `server/composition/` — trusted-source lookup, validation, normalization, and background enrichment.
- `src/app/api/` and `server/apiRegistry.ts` — authenticated API contracts and standalone Hono registration.
- `src/app/member/detail/` — searchable member allergy editor and profile display.
- `src/app/sales/new/` — ingredient-match warnings in search, editor, and cart.

## Code Style

Use existing TypeScript conventions, standard `Request`/`Response` handlers, validated boundary inputs, and project CSS modules. Allergy matching uses stable ingredient IDs rather than display-name string comparison.

```ts
const matchedAllergies = product.activeIngredients.filter((ingredient) =>
  customer.allergyIngredientIds.includes(ingredient.id),
);
```

## Testing Strategy

The user explicitly requested no test-driven development. Implement first, then run existing focused contract checks and lightweight static verification. Do not run npm commands. Browser verification is required only when the Chrome DevTools MCP server is available; otherwise report that visual verification was unavailable.

## Boundaries

- Always: retain source provenance, validate external payloads, time out network calls, normalize ingredient names, and show the matched ingredient in warnings.
- Always: use Thai FDA first when an authoritative record is available, then official international sources.
- Allowed by explicit user approval: persist new health-related member allergy data and call official external drug-data services.
- Never: invent an ingredient, accept arbitrary lookup URLs, hide unresolved composition status, or block an otherwise valid sale.
- Out of scope: diagnosis, interaction checking, dosage advice, excipient allergy detection, and manually entered product compositions.

## Success Criteria

- Member Edit Profile provides a searchable standardized multi-select ingredient list.
- Member detail shows the member's recorded allergic ingredients.
- Product API records expose normalized active ingredients and composition status/provenance.
- Existing known medicines are seeded with authoritative active ingredients; non-medicines may remain not applicable.
- New or unresolved products are automatically queued for authoritative enrichment and retried without staff entering compositions.
- With a member selected, `/sales/new` appends a red warning after matching search-result item names and preserves it in the editor and cart.
- The warning names the matched ingredient and never prevents adding or selling the item.

## Open Questions

None. The user explicitly approved the intent restatement and requested implementation.
