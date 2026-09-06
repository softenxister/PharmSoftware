# Pending Sale lifecycle completion

Date: 2026-09-05
Review baseline: `bd6432a93e8c1e062abb2e8dcea101365698e1b4`

## Scope and result

Complete the existing uncommitted Pending Sale reopening fix: cancellation,
retry, changing bill IDs, customer hydration, meaningful-change detection,
and stale save/delete results. Preserve pending bill identity and complete lines.

- A cancelled effect can restart its request, including the Strict Mode
  cleanup/setup sequence. Completed requests do not rehydrate an edited draft
  when settings refresh.
- Switching requests or clearing the lifecycle invalidates late load results.
  Returning to a previously opened bill starts a fresh request.
- Member bills load the saved customer through the existing single-member API,
  in parallel with their stock catalog. Reopening no longer waits for the full
  member directory. Unavailable or malformed member profiles produce the existing
  retry state instead of substituting empty allergy data.
- The Sale route keys the workflow by bill identity, isolating the cart, payment,
  dialogs, and customer state when moving between bills or starting a new Sale.
- Disposing or clearing a lifecycle discards late save/delete outcomes before
  callers update UI or navigate. This does not undo an already submitted server
  write; its persisted result is visible when sales are read again.

## Standards review

No remaining findings. The initial concern about exposing the coordinator's
low-level start/cancel/complete operations was addressed: production and tests
now share its `run`/`reset` interface. Existing Sale ownership, database schema,
and HTTP contracts are preserved. No dependency was added.

## Spec review

No remaining code blocker found. The review identified late save/delete
navigation after changing bills; generation-based write invalidation and an
explicit cancelled outcome now cover that case.

Final findings: Standards 0; Spec 0. Browser validation remains outstanding.

## Verification

- 86 focused tests passed across Sale lifecycle, HTTP persistence, cart and
  payment logic, receipt behavior, repository validation, and navigation guards.
  The first repository-test attempt lacked the environment configuration;
  all 13 tests in that file passed after loading the project's environment.
- New regressions were observed failing before their fixes: return to an earlier
  bill, missing customer hydration, discarded load after clear, and late writes.
- TypeScript check and production client/server builds passed.
- `git diff --check` passed.
- No browser was available. Coordinator tests simulate effect cleanup and
  restart; they do not establish actual React mounting, accessibility,
  desktop/tablet layout, or browser console behavior.
- The full `npm test` suite remains pending explicit user authorization required
  by `agents.md`; automatic approval review rejected that command.
