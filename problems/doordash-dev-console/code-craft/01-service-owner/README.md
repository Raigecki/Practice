# Code Craft: Service Owner Resolver

Read [PROMPT.md](PROMPT.md) one part at a time. Implement the class in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest 01-service-owner`

Covers the reported "Bootstrap API" question: fan out to upstream services, then handle timeouts and partial failure. It's set in the Developer Console domain.

## Clarifications (decided for these tests)

- The catalog call happens first, because you need `ownerTeamId`. The team and on-call calls then run **in parallel**.
- Timeouts apply to every upstream call. A timed-out enrichment call counts as a failure.
- Warnings are ordered `["team_unavailable", "oncall_unavailable"]`.
- Batch: `ServiceNotFoundError` → `"not_found"`, anything else → `"catalog_unavailable"`.
- Cache: an entry is fresh while `now() - fetchedAt < ttl`.

## What interviewers reportedly score

- Clean separation: the critical dependency (catalog) vs. optional enrichment (team, on-call).
- No timer leaks. Clear the timeout when the race settles.
- Concurrency control that's actually bounded. A worker pool or semaphore works. `Promise.all` over everything doesn't.
- Tests for the edge cases, plus talking through what you'd add.
