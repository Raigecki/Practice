# Scheduler as a Service: model answer

This is one strong path through the problem, not the only one. Interviewers score the reasoning and tradeoffs, not a specific diagram.

---

## 1. Requirements (first ~8 minutes)

**Functional**
- Schedule a one-off job: "at T" or "in N seconds".
- Schedule a recurring job from a cron expression with a time zone.
- A job is a target (HTTP callback or queue topic) plus a payload plus a retry policy.
- Cancel and update a job. Get a job's status and its execution history.

**Non-functional**
- **Reliability:** an accepted job is never lost. This matters most.
- **Timeliness:** fires within ~1s of the scheduled time at p99.
- **At-least-once** execution. Targets must be idempotent. (See §6.)
- **Scale:** 100M one-off jobs/day, 100k recurring schedules, 3x peaks.
- Highly available for writes. A short delay in firing during a failover is acceptable.

**Out of scope (say so):** running arbitrary user code, dependencies between jobs (DAGs), and sub-second precision.

## 2. Estimates

- 100M/day ÷ 86,400 ≈ **1,200 creates/sec** on average, about **3,500/sec at peak**.
- Fires are about the same rate, plus recurring jobs. 100k schedules, mostly hourly or daily, add little on average but cause **spikes at the top of the hour and at midnight**.
- Cancels: order timers are often cancelled, so assume cancels ≈ 50% of creates.
- A job row is ~1 KB with its payload. 100M/day × 1 KB = **100 GB/day**. Keep completed jobs for 7–30 days, then archive to cold storage. Live (pending) jobs are much smaller because most fire within an hour.

Conclusion: the write rate is moderate. The hard parts are **finding due jobs fast**, **not double-firing**, **not losing jobs**, and **spikes when many jobs share a fire time**.

## 3. API

```
POST   /jobs                 { target, payload, run_at | cron+tz, retry_policy, idempotency_key }
                             → { job_id }
DELETE /jobs/{id}            cancel (no-op if it already ran)
PATCH  /jobs/{id}            change run_at / cron / payload
GET    /jobs/{id}            status, next_run_at
GET    /jobs/{id}/executions history: attempt, started, finished, result, lag
```

- `idempotency_key` (unique per client) makes a retried `POST` safe. The order service retrying the create won't schedule two timers.
- Delivery to the target includes `execution_id` so the target can dedupe.

## 4. Data model

**jobs** (the definition)
`job_id, client_id, target, payload, schedule_type (once|cron), run_at | cron_expr+tz, retry_policy, status (active|cancelled|done), next_run_at, version, idempotency_key`

**executions** (one row per firing)
`execution_id, job_id, scheduled_for, status (pending|claimed|running|succeeded|failed|dead), attempt, worker_id, lease_until, started_at, finished_at, error`

Why split them: a recurring job fires many times. History, retries and leases belong to one firing, not to the schedule.

**Recurring jobs:** when execution N is created (or claimed), compute `next_run_at` from the cron expression and create execution N+1. Do this in the same transaction so the chain can't break. Never precompute all future runs.

## 5. High-level architecture

```
clients ──▶ Scheduler API ──▶ Job store (sharded, durable)
                                   │
                         ┌─────────┴──────────┐
                         ▼                    ▼
             Due-job pollers / dispatcher   Cron planner
             (one owner per shard)          (creates next execution)
                         │
                         ▼
                  Ready queue (Kafka/SQS), partitioned
                         │
                         ▼
                  Executor workers ──▶ target (HTTP / topic)
                         │
                         └──▶ executions table (status, result), retries back into the store
```

**Finding due jobs: the core design choice.** Name all three options and pick one:

| Approach | How | Pros | Cons |
|---|---|---|---|
| **DB polling** | Index on `(shard, scheduled_for) WHERE status='pending'`. Each poller runs `SELECT … WHERE scheduled_for <= now() + 1s ORDER BY scheduled_for LIMIT 500 FOR UPDATE SKIP LOCKED` | Simple, durable, easy cancels (update a row) | Polling load; index hot spots at the "now" edge |
| **Time-bucketed store** | Key = `(minute_bucket, shard)`, e.g. Cassandra/DynamoDB. A poller reads the current bucket | Scales writes horizontally, no global index | Cancels are tombstones; buckets get large at midnight |
| **In-memory timing wheel** loaded from the DB for the next N minutes | Poller loads upcoming jobs into a hierarchical timing wheel and fires exactly on time | Precise, cheap per tick | Must reload after a crash; memory bounds |

**Recommended:** a durable store sharded by `hash(job_id) % N`. Each shard is owned by one dispatcher, assigned by lease (ZooKeeper/etcd, or a lease row in the DB). The dispatcher polls its shard every ~500ms for jobs due in the next few seconds and pushes them into the ready queue. Optionally it keeps the next 1–2 minutes in a timing wheel for precision.

**Delayed delivery in SQS** maxes out at 15 minutes, so it can't hold "in 3 days" jobs. A hybrid works: the DB holds long-horizon jobs, and a loader moves anything due within ~15 minutes into a delay queue. Mention this as an alternative.

## 6. Deep dives

### No double-firing, no lost jobs
- **Claim with a lease:** `UPDATE executions SET status='claimed', worker_id=?, lease_until=now()+30s WHERE id=? AND status='pending'`. Or use `SKIP LOCKED`. Only one worker wins.
- **Heartbeats** extend `lease_until` for long-running deliveries. A **reaper** resets executions whose lease expired back to `pending` with `attempt+1`. This is your Fullset `heartbeat_at` / `requeue_stale` pattern.
- **Exactly-once is not possible end to end.** A worker can call the target, then crash before recording success, so the job will run again. The guarantee is **at-least-once delivery + an idempotency key (`execution_id`) the target dedupes on = effectively once**. Saying this clearly is a strong signal.
- Durability: `POST /jobs` returns only after the write is committed with replication. The ready queue is a derived view. If it loses a message, the dispatcher re-finds the row because the store is still `pending` (the same reasoning as "SQS just wakes workers up, Postgres decides").

### Cancels and updates
- A cancel sets `status='cancelled'`. The executor **re-checks status and `version` at fire time**, because the job may already be in the ready queue. That makes cancel races safe without pulling messages out of the queue.

### Hot spots (midnight, top of the hour)
- Shard by `job_id`, **not** by time, so a popular second is spread across all shards.
- Add **jitter** to recurring jobs when the client allows it ("daily, any time 00:00–00:10").
- The ready queue absorbs the burst. Executors autoscale on queue lag.
- **Per-target rate limits** (token bucket per `client_id`/target) so 50k timers at midnight don't take down one downstream service.

### Retries and failures
- Retry policy per job: max attempts plus exponential backoff with jitter. A retry = a new pending execution with `scheduled_for = now + backoff`, so it uses the same path.
- After max attempts the job goes to `dead`, lands in a DLQ, and alerts the owning team.
- Distinguish errors: 4xx means don't retry, 5xx/timeout means retry.

### Dispatcher failover
- The shard lease expires, and another dispatcher takes the shard and polls `scheduled_for <= now()`. That catches everything missed during the gap. Jobs fire a few seconds late, but none are lost. This matches the "a few seconds late is acceptable" requirement.

### Observability
- **Lag = actual fire time − scheduled_for**, p50/p99 per shard. This is the SLO.
- Pending count due in the past (backlog), execution success rate per client, DLQ size, dispatcher lease churn.

### Multi-tenancy
- Per-client quotas on creates and fires, and payload size limits. One team's bug creating 10M jobs must not delay everyone else's order timers. You can use separate priority queues per tier, e.g. order-critical vs. batch.

## 7. Wrap-up tradeoffs to say out loud

- Polling vs. push: polling every 500ms adds up to 500ms of lag, which fits a 1s SLO. Use a timing wheel only if precision has to be tighter.
- A relational DB is fine up to a few thousand writes/sec per shard. Start with sharded Postgres, and move to Cassandra/DynamoDB with time buckets if writes keep growing.
- Keeping completed executions has a cost: archive them to S3 after N days.
- What I'd build first (MVP): one Postgres cluster, `SKIP LOCKED` pollers, leases + reaper, at-least-once with an `execution_id`. Then shard when the numbers require it.

## Common mistakes (where the reported candidate likely lost points)

- Jumping to "use a cron on a server" or "use Kafka" without stating requirements or scale.
- Saying "exactly once" without explaining how. That's a red flag.
- One global poller with no plan for it crashing or for sharding.
- Ignoring cancels that race with execution.
- Not mentioning lag as the metric that defines "working".
