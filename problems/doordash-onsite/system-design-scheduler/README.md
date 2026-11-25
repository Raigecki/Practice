# System Design: Scheduler as a Service

_Format: 45–60 minutes, one open-ended prompt with no parts. You lead. The interviewer answers questions but won't steer you._

Don't open [ANSWER.md](ANSWER.md) until you've done a full attempt.

---

## The prompt (as the interviewer would say it)

> "Design a job scheduler as a service. Teams across DoorDash should be able to schedule work to run at a specific time or on a recurring schedule, and the service makes sure it runs."

That's all you get. In the reported interview the candidate struggled because they **couldn't come up with requirements smoothly**. Treat the first 8 minutes as part of the test.

---

## If you ask, the interviewer will tell you

Only use these if you actually ask the question. Write your questions down first, then check which ones you missed.

| You ask about | Answer |
|---|---|
| Who uses it? | Internal teams. Examples: send a "your order is late" notification at T+40min, run the nightly Dasher pay calculation, expire a promo at midnight, retry a failed refund in 10 minutes. |
| What is a "job"? | The caller provides a target, either an HTTP endpoint to call or a message to publish to a queue, plus a payload. The scheduler doesn't run user code itself. |
| Schedule types? | One-off ("at time T" or "in N seconds") and recurring (cron expressions). |
| Scale? | About 100M one-off jobs a day, mostly short delays such as order timers. About 100k recurring schedules. Peaks are 3x the average around lunch and dinner. |
| How on-time? | A job should fire within about 1 second of its scheduled time at p99. A few seconds late during a failover is acceptable. |
| Exactly once? | Teams want "runs once". Discuss what you can actually guarantee. |
| Failures? | If the target fails, retry with a per-job policy. Callers want to see job status and history. |
| Cancel / update? | Yes. Order timers get cancelled constantly, for example when the order is delivered. |
| Ordering between jobs? | Not required. Each job is independent. (Dependencies between jobs are out of scope.) |
| Multi-region? | Mention it, but don't design it in depth. |

---

## Checklist: did you cover these?

Go through this after your attempt. Don't look at it during.

- [ ] Functional and non-functional requirements stated **before** drawing anything, with numbers
- [ ] Back-of-envelope: writes/sec, fires/sec at peak, storage
- [ ] API: create, cancel, get status, list runs, with an idempotency key on create
- [ ] Data model: jobs vs. executions (runs), and how recurring schedules produce the next run
- [ ] How "due" jobs are found quickly without scanning the whole table
- [ ] How workers claim a job without two of them running it
- [ ] What happens when a worker dies mid-execution
- [ ] At-least-once delivery + idempotent targets, and why exactly-once isn't possible end to end
- [ ] Hot spots: thousands of jobs due at the same second (e.g. midnight), and how the store is partitioned
- [ ] Retries, backoff, dead-lettering, and protecting downstream targets (rate limits)
- [ ] Observability: lag (actual minus scheduled fire time) as the main SLO metric
- [ ] Tradeoffs said out loud: DB polling vs. timing wheel vs. a queue's delayed delivery

## How to run this session

1. Set a 45-minute timer. Speak out loud or type into a scratch file.
2. Use roughly 0–8 min for requirements and estimates, 8–20 for API, data model and high-level design, 20–40 for deep dives, and 40–45 for wrap-up and tradeoffs.
3. Then read ANSWER.md and compare against the checklist.

You have built a smaller version of this at Fullset: Postgres as the source of truth, SQS as a wake-up signal, `claim_next` with a lock, heartbeats and requeueing. Use it. "I've built this pattern before, and here's where it would break at 100M a day" is a strong answer.
