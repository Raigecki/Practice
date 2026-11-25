# fullset-async-be — EM interview prep (30 min, past experience, role ≈ 80% BE / 20% FE)

## 0. Warm-up questions (answer out loud first, 1–2 min each)

**Opening**
1. Walk me through your background in 2 minutes.
2. What are you working on right now? What's your role on the team?
3. Why this role, and why backend-heavy?

**Depth on a project (expect most of the time here)**
4. Tell me about the most technically complex system you've built. Draw it for me.
5. Why SQS + workers rather than doing the work in the request?
6. How do you make sure a job never runs twice, or gets lost?
7. What happens when a worker crashes mid-job?
8. How does it scale? What's the bottleneck?
9. What would you change if you rebuilt it today?
10. What broke in production, and how did you find and fix it?
11. How do you know it's healthy? (logging, metrics, alerts)

**Ownership / judgment (EM-flavored)**
12. Tell me about a trade-off where you chose simple over "correct".
13. A time you disagreed with a teammate or stakeholder on a technical decision.
14. How do you scope and ship when the requirements are fuzzy?
15. How do you work with frontend / product? (this is where your 20% FE goes)
16. Something you'd do differently on how you worked, not on the code.
17. What kind of team or manager do you do your best work with?

**Your questions for them** (have 2–3 ready)
- What does the BE own end to end, and where does it hand off to FE?
- What's the biggest reliability or scaling pain right now?
- What does success look like at 3 and 6 months?

---

## 1. How to pitch your experience (concise)

**The 2-minute intro: present → highlight → why here**
1. **Now (20s):** "I'm a backend-leaning full-stack engineer at Beacon / Fullset. I own the async backend: queues, workers, Postgres, AWS."
2. **Highlight (60s):** one sentence of problem + scale, one of architecture, one of impact. (See the pitch below.)
3. **Breadth (20s):** the rest of the stack. Notifications pipeline (email/SMS/web push), the FE work (React/Next, Uppy uploads, the viewer), and Docker/LocalStack local dev.
4. **Why here (20s):** "I want to go deeper on backend systems. That's where I've had the most fun and done the most impact."

**Rule for the 80/20:** lead every story with the BE decision. Mention FE only as "and I built the client side too, so I designed the API around what the UI actually needed."

**For each deep-dive story, use STAR-lite:** situation (1 line) → what *I* decided and why → a number or outcome → what I'd change. Say "I" for your own work and "we" for shared work. Be accurate about which parts you built.

**One-line pitch for the map pipeline:**
> "Users upload huge construction PDFs, up to 40+ ARCH-E pages. I built the async pipeline that turns them into zoomable tile maps. Uploads go straight from the browser to S3, so they never pass through our API. Jobs are scheduled fairly across users from Postgres, with SQS used only as a wake-up signal. Workers recover from crashes on their own and autoscale on ECS. The FE shows queue position and ETA."

---

## 2. Design rundown — what the system is

A Python (3.12, Poetry) monorepo of **Docker containers on AWS ECS**. Services talk through **SQS/SNS**, with **Postgres (RDS)** as the source of truth. It runs fully locally with **LocalStack + Postgres via docker compose**, with no code differences from prod (only env vars change).

### Containers
| Container | Role |
|---|---|
| `map-api` | FastAPI. Upload init, signed S3 URLs, job status/ETA, serving tiles |
| `worker-router` | Polls `MAIN_QUEUE`. A `JOB_REGISTRY` dict maps job name → handler. It fans out to SNS (notifications) or to lane queues (maps) |
| `worker-email` | Consumes the email/SMS queue (via SNS fan-out with a `channel` attribute filter) and renders templates |
| `worker-api` | Web push via VAPID (`pywebpush`). Deletes dead subscriptions on 404/410, TTL 24h |
| `worker-map-processor` | The heavy part: PDF → previews + title-block OCR → DZI tile pyramid |

**Pattern:** one entry queue plus a router means producers only know one queue URL and a job name. Adding a job type is one registry entry.

### Notification flow
`Go BE → SQS main → router → SNS topic (message attr channel=webpush|email_sms) → per-channel SQS → worker`. SNS filtering decouples channels. `user_mention` fans out one message per mentioned user.

### Map pipeline (the story to tell)
```
FE ─POST /map/uploads──▶ map-api: insert map_jobs(status=awaiting_upload)
FE ─Uppy multipart, direct to S3 (map-api only *signs* each call)──▶ S3 uploads
FE ─POST /upload-complete──▶ map-api: HEAD + size + magic-byte check → queued, SQS send
router → scrape queue → map-processor scrape slot:
    pdfinfo page count, ghostscript, pdfplumber title-block (Textract OCR fallback),
    3 preview JPEGs per page → status=awaiting_review (+ page_suggestions)
FE user reviews pages ─POST /tile-pages──▶ one tile job per included page
router → tile queue → tile slot: ghostscript → pyvips dzsave → S3 tiles → ready
FE polls status (batch endpoint) with queue_position / ETA; OpenSeadragon renders the DZI
```

### Key design decisions (the "why"s interviewers want)
1. **Direct-to-S3 resumable multipart uploads.** Large files never touch the API. Per-part retry plus ListParts lets an upload resume. The API signs each call, scoped to the job's own key. An S3 lifecycle rule aborts orphaned multipart uploads after 7 days.
2. **Validate before enqueueing.** HEAD + magic bytes, so bad files fail fast and never consume a worker.
3. **Split scrape vs tile into two job types and two lanes.** Each lane has its own queue and slots, so a tile backlog never delays a scrape (the user is waiting on the review screen). It also adds a human review step before the expensive tiling.
4. **Postgres decides, SQS just wakes workers up.** A slot long-polls, then runs `claim_next(lane)` *whether or not a message came*. The claim is a single `UPDATE … WHERE status='queued' RETURNING` under `pg_advisory_xact_lock` per lane, so a job can't run twice and a lost message can't strand a job. No DLQ is needed; retries live in `map_jobs.attempts`.
5. **Fair scheduling.** Take the oldest queued job of the owner with the *fewest running jobs*. So a 1-page upload doesn't wait behind someone's 40 pages. **Burst slots** only take jobs from owners with nothing running, so every new uploader starts immediately.
6. **One process per job.** pdfplumber and the upload loops are CPU-bound Python, and threads share the GIL. Each job runs in a spawned child with its own process group and temp dir, so it can be killed cleanly.
7. **CPU priority.** Tile jobs run at `nice 10`, so scrapes (interactive) win the CPU, but tiles still use idle cores. The worker pins itself to its cgroup CPU quota so `nice` actually has an effect.
8. **Crash/hang recovery.** Heartbeat every 30s. A stale heartbeat (>120s) means the job is requeued *at its original place*. No progress for 15 min means a hung job: kill the process group and retry. After 3 attempts the job is marked failed.
9. **ETAs.** Seconds-per-page history × page count, switching to the job's own pace once it's 15% in. The queue wait is simulated by freeing the live slots (from the `map_workers` table) as running jobs finish.
10. **Ops.** ECS autoscaling on queue backlog per task, plus an `OwnersWaiting` CloudWatch metric. **Task scale-in protection** while a job runs. Graceful SIGTERM (stop claiming, finish running jobs, 120s stopTimeout). Migrations rolled out in a specific order with old workers stopped.

### Honest weaknesses / "what I'd change" (have 2 ready)
- The advisory lock serializes claims per lane. That's fine at this scale (one short query), but it's a ceiling at very high throughput.
- Raw-SQL migrations are run manually. I'd add a migration tool (Alembic) and run it in CI/CD.
- Status is polled. SSE/WebSocket or push notifications would be nicer.
- The legacy `/map/tilesheets` path still runs alongside the split flow. Remove it once the FE has migrated.
- Notifications use the bare `poll_queue` with redelivery on exception but no DLQ or idempotency keys, so a poison message retries forever.
- Few automated tests on the workers. Add tests for `claim_next` fairness and recovery against a real Postgres.

---

## 3. My answers (fill in)

**2-min intro:**

**Deep-dive story (map pipeline):**

**Bug / incident story:**

**Trade-off story:**

**Disagreement / collaboration story:**

**What I'd change:**

**Why this role:**
