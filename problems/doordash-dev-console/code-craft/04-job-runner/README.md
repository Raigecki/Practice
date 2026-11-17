# Code Craft: Job Runner

Read [PROMPT.md](PROMPT.md) one part at a time. Implement in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest 04-job-runner`

## Clarifications (decided for these tests)

- Ties between ready jobs break by input position, including jobs that become ready later (see the "unlocked later" test).
- Validation order: duplicates, then unknown deps, then cycles.
- `CycleError.jobIds` = every job that couldn't be ordered (the cycle **and** anything downstream of it), in input order.
- A job with one failed dep is skipped immediately, even if its other deps are still running.
- A retrying job keeps its concurrency slot while it sleeps.
- `attempts` is 0 for skipped jobs. Failed jobs report the **last** error message.

## What interviewers reportedly score

- Kahn's algorithm, or DFS with colors, explained with its complexity, O(V + E).
- In Part 2, an event-driven scheduler ("when a job finishes, unlock its children, then refill slots"). Don't run level by level with `Promise.all`, because that waits for the slowest job in each level.
- Tests for failure propagation.
