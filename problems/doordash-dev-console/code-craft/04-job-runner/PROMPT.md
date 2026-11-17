# Job Runner

_Format: 60 minutes, Code Craft. Parts are revealed one at a time. Don't read ahead._

"Job scheduler" has been reported as a DoorDash E4 system design prompt. This is the coding version: Developer Console's Software Templates (Scaffolder) run a pipeline of steps to create a new service.

---

## Part 1

Creating a service runs steps like `create-repo`, `register-in-catalog`, `create-pagerduty`, `create-dashboards`. Some steps depend on others.

```ts
{ id: "register-in-catalog", deps: ["create-repo"] }
```

**Write `executionOrder(jobs)`** that returns an order where every job comes after all of its deps.

- When several jobs could go next, pick the one that appears **first in the input**, so the output is deterministic.
- Throw `DuplicateJobError` for repeated ids and `UnknownDependencyError` for deps that don't exist.
- If there's a cycle, throw `CycleError` listing every job that can't be scheduled.

---

## Part 2

Now actually run them. Each job has `run: () => Promise<void>`.

**Write `runJobs(jobs, { maxConcurrency })`** that returns each job's result.

- Start a job as soon as all its deps have **succeeded**. Don't wait for unrelated jobs.
- Never run more than `maxConcurrency` jobs at once (default: unlimited).
- If a job fails, mark it `failed` and mark everything downstream of it `skipped`. Unrelated jobs keep running.
- Validate the graph before running anything.

---

## Part 3

`create-pagerduty` calls an external API that fails often.

**Add retries:** a job may set `retries` (extra attempts). Between attempts, wait `backoffMs * 2^(attempt-1)` (50, 100, 200, …). Report how many attempts each job took. Use the injected `sleep` so tests don't actually wait.

---

## Discussion

- The runner process crashes halfway through. How do you resume without re-creating the repo? (persist state per step, idempotent steps, idempotency keys)
- Make it distributed: many workers, thousands of pipelines. How do workers claim jobs without double-running them? (leases or visibility timeouts, `SELECT … FOR UPDATE SKIP LOCKED`, a queue)
- At-least-once vs. exactly-once: which can you actually get, and what does that require of each step?
- Should a sleeping retry hold a concurrency slot? What are the tradeoffs?
- Add jitter to the backoff. Why does it matter when 500 pipelines hit the same flaky API?
