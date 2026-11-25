# Plan: fan out map scraping into one job per page (fullset-async-be)

Repo: `beacon/fullset-async-be`. Read `src/containers/MAP_TRACKING.md` first. It describes the current scrape/tile flow, lanes, `claim_next` fairness, heartbeats and `requeue_stale`.

## Goal
Today one `scrape` job processes the whole PDF in a single process, 2 pages at a time in threads. Its results stay in memory until the end, so a crash restarts from page 1 and one bad page fails the whole set. Change it to:
- a short **split** parent job that counts the pages and creates N **scrape_page** child jobs
- children run on any free scrape slot across the cluster
- each page succeeds or fails on its own
- the review screen fills in as pages finish

Tiling, the router and the tile lane stay as they are.

## Decisions so far
- **Fan out rather than checkpoint within one job.** Fan-out also gives parallelism across the cluster and fairness page by page, where today one 40-page scrape holds one slot for minutes. Tiling already works this way.
- **No PDF splitting.** A child renders page k straight from the original (`gs -dFirstPage=k -dLastPage=k`), the same way tile jobs already do. There's no `pdfseparate`/`qpdf` step, no page PDFs in S3, and no edge cases from duplicated resources or malformed files. `split` splits the *work*, not the file.
- **A per-task disk cache for the original.** It gets downloaded once per worker task, not once per page (see §4). Holding the file in one parent process was ruled out because it ties every child to one machine, which loses the parallelism across the cluster and puts crash recovery back to all-or-nothing.
- **The parent waits in a status no worker owns** (`awaiting_pages`). It's not in `_RUNNING_STATUSES`, so heartbeats, `requeue_stale`, fairness counts and the running-job ETAs ignore it. Otherwise the parent gets requeued 120s after the split ends, re-runs the split, and is failed after 3 attempts while its children are still running.
- **Fan-in has three parts:** an idempotent `close_parent_if_done` that takes a lock on the parent row, a call to it from every path where a child finishes, and a reconciler sweep in housekeeping as a safety net.

## Target flow
```
POST /map/uploads          map-api INSERT parent (job_type=split, status=awaiting_upload)   [was job_type=scrape]
POST /upload-complete      unchanged: validate → queued → SQS main {job:"scrape_pdf"} → router → scrape queue
split (scrape lane)        claim → splitting (running, heartbeated)
                           → fetch original via the task cache → pdfinfo page count (images: 1)
                           → ONE TRANSACTION: INSERT N rows (job_type=scrape_page, parent_job_id, page=k,
                             owner_id, upload_s3_key=original, status=queued, queued_at=parent.queued_at)
                             + UPDATE parent page_count=N, status=awaiting_pages
scrape_page (scrape lane)  claim → scraping → fetch original via the task cache → _scrape_page(page=k)
                           → write page_suggestion on its own row → ready | failed
                           → close_parent_if_done(parent)
parent                     awaiting_pages → awaiting_review once every child is ready/failed
POST /tile-pages           as today, also accepts a split parent. Tile jobs use the task cache too
```

Parent statuses: `awaiting_upload → queued → splitting → awaiting_pages → awaiting_review → done` (or `failed | cancelled`).

## Changes

### 1. Migration `shared/migrations/010_map_jobs_scrape_fanout.sql`
- `ALTER TABLE map_jobs ADD COLUMN IF NOT EXISTS page_suggestion JSONB;` holds one page's result on a child row.
- `CREATE INDEX IF NOT EXISTS idx_map_jobs_parent ON map_jobs (parent_job_id) WHERE parent_job_id IS NOT NULL;`
- `job_type` is `VARCHAR(10)`, and `'scrape_page'` is 11 characters. See open question 1.

### 2. `shared/map_repo.py`
- `LANE_JOB_TYPES["scrape"] = ("scrape", "split", "scrape_page")`. Keep `scrape` so old jobs already running still finish.
- **`lane_for()`** returns `"scrape"` for all three types. It's currently `== "scrape"`, which would send split and page jobs to tile-lane ETAs.
- **Claim status** (the CASE in `claim_next`): `split → 'splitting'`, `scrape_page → 'scraping'`. Add `'splitting'` to `_RUNNING_STATUSES`. **Don't** add `awaiting_pages`.
- **Claim order:** `ORDER BY (job_type = 'split') DESC, COALESCE(a.n,0), q.queued_at, q.page NULLS LAST, q.id`.
  - Split jobs come first, so a new upload never waits behind page jobs.
  - `page` breaks the tie between siblings, which share `queued_at`. Without it they'd run in random UUID order and the review screen would fill in out of order.
- **`claim_next` RETURNING** adds `parent_job_id` and `owner_id`. A child needs its parent for the preview keys, the close-parent check and the cancel check.
- **Fairness key:** children copy `owner_id`. When `owner_id` is NULL, the parent's `CAST(id)` and its children's `CAST(parent_job_id)` already resolve to the same key.
- **`create_page_jobs(parent_id, n) -> list[str]`:** insert the children and update the parent in **one transaction**. `SELECT … FOR UPDATE` the parent first. If children already exist (the split was retried), return them instead of inserting again.
- **`close_parent_if_done(parent_id)`:** in one transaction, `SELECT … FOR UPDATE` the parent.
  - If it's `awaiting_pages` and no child is still pending, collect the children's `page_suggestion` ordered by `page` into `page_suggestions` (same shape as today).
  - Then set `status='awaiting_review'`, `progress_pct=100`, `finished_at`.
  - Do nothing if the parent is `cancelled` or already closed.
  - Use a lock and a check, not a decrement counter. It's idempotent and can't drift.
- **Parent progress:** `progress_pct` = finished children / N × 100, updated by the same function on every call.
- **`requeue_stale`:** when it fails a `scrape_page` child (attempts used up), call `close_parent_if_done` for that child's parent.
- **Reconciler `close_stuck_parents()`:** close any parent in `awaiting_pages` whose children are all `ready`/`failed`/`cancelled`. Run it from housekeeping every 30s. It catches any path that forgot to close the parent.
- **`request_cancel`:** add `splitting` and `awaiting_pages` to the list of cancellable statuses. Cancelling a split parent also marks its `queued` children `cancelled`.
- **Duration history:** filter the `recent` CTE in `queue_info` by job type.
  - Seconds per page come from `scrape_page` rows (plus old `scrape` rows while they exist).
  - The split average comes from `split` rows, using their split duration. A split parent's `finished_at` is when its *children* finished, so it must not feed `seconds_per_page`.
  - Fix `_expected_seconds`/`_remaining_seconds`, which only check for `"scrape"`.

### 3. `shared/schemas.py`
- `MapJobMessage` adds `parent_job_id: str | None` and `owner_id: str | None`. `main._message_for` passes them through.

### 4. Per-task cache for the original (`worker-map-processor`)
- `fetch_original(upload_s3_key, file_type) -> path`, used by `_run_split`, `_run_scrape_page` and `_run_tile`.
- **Path:** `{MAP_CACHE_DIR}/{sha1(upload_s3_key)}/original.{ext}`. Key it by the S3 key, not the job id, so the split, its children and later tile jobs all hit the same file.
- **On a miss,** download to a temp file in the same directory, then `os.rename` it into place. The rename is atomic, so two children on the same task can race safely.
- **On a hit,** `os.utime` the file so eviction sees it was used recently.
- **`MAP_CACHE_DIR`** (default `/var/cache/map-originals`) must be outside the per-job workdir, because `main._run` deletes the workdir and the child sets `tempfile.tempdir` to it.
- **Eviction in housekeeping:**
  - Delete entries not used for `MAP_CACHE_TTL_SECONDS` (default 3600).
  - Also delete the least recently used entries while the cache is over `MAP_CACHE_MAX_BYTES`.
  - A file deleted while a job has it open stays readable on Linux. A job that misses just downloads again.
- **ECS ephemeral storage:** 20 GB by default. Size it so the cache cap, plus the slots × their render temp files, plus headroom all fit (up to 200 GB).
- **Check the VPC:** S3 should be reached through a gateway endpoint (free), not a NAT gateway (~$0.045/GB). This applies to tile jobs today as well.

### 5. `worker-map-processor/processor.py`
- **`run()` dispatch:** add `split → _run_split` and `scrape_page → _run_scrape_page`. Keep `_run_scrape` for old jobs.
- **`_run_split`:** `fetch_original` → `_page_count` → `create_page_jobs`.
  - If the parent was cancelled in the meantime, stop.
  - If this throws, the parent is `failed` as today. There's nothing to scrape.
- **`_run_scrape_page`:** `fetch_original` → `_scrape_page(page=k)` with a no-op checkpoint callback, or one that updates the child's `progress_pct`.
  - Since the child renders from the original, `page` is the real page number, so `page_index` and the preview keys are already right.
  - Pass the **parent** id for preview keys (`uploads/{parent_id}/page-{k}/…`) so the FE image routes don't change. `_scrape_page` uses its `job_id` argument for the keys.
  - On success: write `page_suggestion`, set `ready`.
  - On an exception: set `failed` + `error_message`.
  - Either way, then call `close_parent_if_done`. **A failed page doesn't fail the parent.**
- **Cancellation:** a child's `_check_cancelled` also treats a `cancelled` parent as cancelled.
- **Per-page stall limit:** `MAP_PAGE_STALL_SECONDS` (default 300) for `scrape_page` in `main._watch`, alongside the existing 900s.

### 6. Slot sizing
- Today each scrape job runs `map_tile_workers=2` page threads. A page job is one page per process, so per-task throughput drops from (slots + burst) × 2 to (slots + burst).
- Raise `MAP_SCRAPE_SLOTS` (e.g. 2 → 4) and re-check memory using the `memory current=… peak=…` logs.
- Each page now pays for spawning a process (importing pyvips etc.). Measure this. If it's significant next to a ~5s page, that argues for a pool of reusable child processes later.

### 7. `map-api`
- **`POST /map/uploads`:** insert `job_type='split'` behind `MAP_SCRAPE_FANOUT` (default off). When it's off, keep inserting `scrape`.
- **`POST /upload-complete`:** unchanged.
- **`GET /map/jobs/{id}`** for a split parent:
  - Add `pages: [{page, status, progress_pct, page_suggestion, error_message}]` from the children, plus `summary: {ready, pending, failed}`.
  - Keep `status`, `page_suggestions` and `page_count` so the current FE keeps working.
  - The FE treats `scraping`/`processing` as in progress (`use-map-jobs.ts`), so it needs to handle `splitting` and `awaiting_pages` too, or map-api reports both as `scraping`. See open question 5.
- **`POST /tile-pages`:** accept `job_type IN ('scrape', 'split')`. v1 keeps the `awaiting_review` requirement. Progressive confirm is open question 3.
- **Cancel** on a split parent cascades through `request_cancel` (§2).

### 8. Router
- No change. `scrape_pdf` already goes to the scrape queue.

## Edge cases to test
- The split crashes before its commit → retried, children inserted once.
- The split is retried after its children exist → `create_page_jobs` returns the existing ones, no duplicates.
- **The parent sits in `awaiting_pages` for longer than 120s → `requeue_stale` doesn't touch it.**
- Two children finish at the same moment → the row lock means exactly one closes the parent.
- A child fails 3 times through `requeue_stale` → the parent still reaches `awaiting_review`, with that page marked failed.
- A child ends without closing the parent (killed between its write and the close) → the reconciler closes the parent within 30s.
- The parent is cancelled while children run → queued children are cancelled, running ones stop at their next check, and `close_parent_if_done` leaves the parent `cancelled`.
- Two children on the same task miss the cache at the same moment → both download, one rename wins, both work.
- The cache is evicted mid-job → the open file stays readable, and the next job downloads again.
- Pages are claimed in page order within a set.
- A single-page PDF and a PNG upload → one child, same flow.
- Fairness: one owner's 40-page set plus another owner's 1-page set → the 1-page set's split and page run before most of the 40.
- Old `scrape` jobs still running during the deploy finish with `_run_scrape`.

## Rollout
1. Run migration 010.
2. Deploy `worker-map-processor`: it handles split, scrape_page and scrape, and has the cache plus the retuned slots and ephemeral storage.
3. Deploy `map-api` with `MAP_SCRAPE_FANOUT=0`. Turn it on in staging, then in prod.
4. FE follow-up: handle the new statuses, render `pages[]` progressively.
5. Once no `scrape` jobs remain, remove `_run_scrape`.

## Open questions
1. **`job_type` names:** widen the column to `VARCHAR(20)` for `scrape_page`, or use shorter names (e.g. `page`)?
2. **Wake-ups from the worker after the split:** I'd skip them. Idle slots check the DB every 10s, so they'd save ≤10s and they need a new SQS send path plus an IAM change.
3. **Progressive confirm:** allow `tile-pages` while the parent is in `awaiting_pages`, for pages that are `ready`? If so, when does the parent become `done`, and can `tile-pages` be called more than once?
4. **Retries for pages that throw:** stay `failed` until a manual `POST /map/jobs/{parent}/pages/{k}/retry`, or retry automatically up to `MAP_MAX_ATTEMPTS`?
5. **New statuses toward the FE:** show `splitting`/`awaiting_pages` as they are, or map both to `scraping` in map-api so the FE needs no change for v1?
6. **ETA scope:** keep v1 ETAs simple (a parent's remaining time ≈ pending pages × seconds per page ÷ scrape slots), or simulate the slots per child now?

## Out of scope
- Splitting the PDF into page files. Revisit only if downloads (cache misses) show up in metrics.
- A separate split lane or service, or Lambda.
- Scheduling that prefers tasks where the file is already cached (data locality). It would fight the fairness ordering.
