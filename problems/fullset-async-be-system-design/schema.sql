-- map_jobs as it looks after migrations 001–009 (consolidated, grouped by purpose).
-- Source: fullset-async-be/src/containers/shared/migrations/

CREATE TABLE map_jobs (
    -- identity
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type           VARCHAR(10)  NOT NULL DEFAULT 'legacy', -- scrape | tile | legacy
    parent_job_id      UUID,                                   -- tile job -> the scrape job it came from
    page               INT,                                    -- tile job: which PDF page to tile
    tilesheet_id       VARCHAR(255),                           -- NULL for scrape jobs (no tilesheet yet)
    version_number     INT,                                    -- NULL for scrape jobs

    -- input
    upload_s3_key      VARCHAR(500) NOT NULL,                  -- uploads/{job_id}/original.pdf
    original_filename  VARCHAR(255),
    original_file_type VARCHAR(10),                            -- pdf | png | jpeg | webp

    -- state
    status             VARCHAR(50)  NOT NULL DEFAULT 'queued',
        -- scrape: awaiting_upload -> queued -> scraping -> awaiting_review -> done
        -- tile:   queued -> tiling -> ready
        -- any:    -> failed | cancelled
    progress           VARCHAR(255),                           -- human-readable ("page 3/12")
    progress_pct       INT          NOT NULL DEFAULT 0,        -- 0-100, monotonic progress bar
    error_message      TEXT,

    -- results
    page_count         INT          NOT NULL DEFAULT 1,        -- set by scrape
    page_suggestions   JSONB,                                  -- scrape: [{page_index, suggested_number,
                                                               --   suggested_title, suggested_project_number, source}]
    dzi_manifest_key   VARCHAR(500),                           -- tile: where tilesheet.dzi lives in S3
    image_width        INT,
    image_height       INT,

    -- scheduling / recovery
    owner_id           VARCHAR(255),                           -- user id, the fairness key
    queued_at          TIMESTAMP,                              -- place in line (kept on requeue)
    started_at         TIMESTAMP,
    finished_at        TIMESTAMP,                              -- also feeds ETA history
    heartbeat_at       TIMESTAMP,                              -- worker updates every 30s; stale > 120s = requeue
    attempts           INT          NOT NULL DEFAULT 0,        -- +1 per claim; > 3 = failed

    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_map_jobs_tilesheet ON map_jobs (tilesheet_id, version_number);           -- status lookups by sheet
CREATE INDEX idx_map_jobs_sched     ON map_jobs (status, job_type, queued_at);            -- claim_next
CREATE INDEX idx_map_jobs_finished  ON map_jobs (job_type, finished_at DESC)
    WHERE finished_at IS NOT NULL;                                                        -- ETA history

-- One row per live worker task; feeds the queue-wait simulation.
CREATE TABLE map_workers (
    id                 VARCHAR(255) PRIMARY KEY,
    scrape_slots       INT       NOT NULL,
    tile_slots         INT       NOT NULL,
    scrape_burst_slots INT       NOT NULL DEFAULT 0,
    tile_burst_slots   INT       NOT NULL DEFAULT 0,
    last_seen          TIMESTAMP NOT NULL DEFAULT NOW()
);
