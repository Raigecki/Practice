# Debugging: Staging Environment Reservations

_Format: 45–60 minutes. **No AI.** Modeled on the reported concurrency debugging round, where the same Dasher sometimes got two orders under load._

`solution.ts` is the backend for a Developer Console plugin. Engineers reserve one of a few shared staging environments for a set time. Bug reports from Slack:

- "Alice and I both got staging-1 at the same time and stomped on each other's deploy."
- "I reserved staging for an hour and it was gone a few seconds later."
- "Someone released my environment out from under me."
- "The page 500s when I typo an env name."

**There are 4 bugs** (one has two parts). Fix them in place. Your fixes must keep the tests that pass today passing. One of them only exists to catch an unsafe fix.

Run: `npx vitest 02-env-reservations`

## How to practise this round

1. Read the class and its doc comments first. The comments are the spec.
2. **Reproduce before fixing.** For the race, explain exactly which interleaving causes it: which line each request is on when the other one runs.
3. JS is single-threaded, so why is there a race at all? Be ready to explain this clearly. It's the core of the round.
4. Prefer the *smallest safe* fix, and say why it's safe.

## Follow-ups the interviewer may ask

- This runs on 6 replicas behind a load balancer, with state in Postgres. Your in-memory fix no longer works. What now?
  - `UPDATE envs SET owner=$1, expires_at=$2 WHERE id=$3 AND (owner IS NULL OR expires_at <= now() OR owner=$1)`, then check the row count. This is a conditional write (compare-and-set).
  - Or `SELECT … FOR UPDATE` inside a transaction. Or optimistic locking with a `version` column.
  - Or a Redis `SET key value NX PX ttl`. What happens if Redis fails over?
- The audit write goes to a different system from the reservation. How do you keep the two consistent? (transactional outbox)
- Should the client send an idempotency key? What happens when a reserve request times out and the UI retries?
- How would you test for races in CI without flaky tests?

Spoilers: [BUGS.md](BUGS.md). The fixed code is in `reference.ts`.
