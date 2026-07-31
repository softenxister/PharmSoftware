# ADR-002: Use deep modules and earned subfolders

## Status

Accepted

## Date

2026-07-31

## Context

ADR-001 established Pharm's Vite page-and-feature architecture, but several workflows still concentrate unrelated state, rendering, persistence, and domain rules in very large files. Mechanical file-size splitting would reduce line counts while creating shallow modules with wide callback interfaces and poor locality.

## Decision

Keep ADR-001's top-level structure and audit every handwritten module for meaningful ownership and depth improvements.

- Prefer 250–400 lines for handwritten implementation and review files approaching 500 lines.
- Permit a rare documented exception up to roughly 550 lines when splitting would create a shallow interface.
- Create subfolders only when several cohesive files form a deep module; keep small modules flat.
- Keep feature-specific CSS and tests with their owning module.
- Test through the same interface used by callers before removing tests for absorbed shallow helpers.
- Update callers atomically when moving files; do not leave compatibility re-exports, duplicate implementations, or broad barrels.
- Preserve user-visible behavior, desktop/tablet layout, database schema, and HTTP contracts unless a separately tested correctness fix is approved.
- Use existing React and server patterns without adding runtime dependencies.
- Exclude generated Prisma code, schema/migrations, data outputs, and static assets from structural refactoring.

## Considered Options

### Split every file mechanically

Rejected because line count alone does not create depth and would spread workflow knowledge across shallow interfaces.

### Replace the top-level architecture with domain packages or a monorepo

Rejected because Pharm remains one Vite client and one Node server; ADR-001 already provides the appropriate runtime structure.

## Consequences

Every refactoring increment must leave the application runnable, pass targeted verification, and be independently revertible. Files that are already deep and correctly owned remain unchanged even when the surrounding area is audited.
