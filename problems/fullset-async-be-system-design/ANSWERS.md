**Opening**

1. Walk me through your background in 2 minutes.
   For the past 4 years I have been mostly working on the Frontend at both Microsoft and Tiktok. At Microsoft I was part of the Fabric team which built analytics App which processes large streams of data and allows users to set triggers and automation. For Tiktok, I worked in creater growth, where I made various campaigns and tasks to help the user grow in followers and engagement.

2. What are you working on right now? What's your role on the team?
   At fullset this past 7 months I've been doing fulls stack work, React Next.js in the frontend, In the backend with Python as the business logic and Postgress as the DB. I designed their communications system as well as their asynchronous tilesheet processing infrastructure.

3. Why this role, and why backend-heavy?
   I believe that this role will challenge me to really round out my skills. Also I believe that my background in the Frontend will be very benefical when I make internal tools because at the end of the day, a simple and easy to use product will help improve the productivity of everyone

4. The most technically complex system that I've built is the Map service. The service receive a large number of PDFS, asynchronouysly scrapes the information to it, and passes it back to the Record service to be processed and stored. Then upon user confirmation / cancellation, the tiles are asynchronously turns the pdfs into dzi images for the user to be able to draw on.

The process goes like this

Client -> initUpload -> RecordService -> Map-api -> inserts into jobs-table job with status awaiting_upload

Map-api -> Signed multipart s3 url -> Record Service -> Client
Client uploads file to s3. Client calls uploads/{upload_id}/upload-complete
map-api sets the status of job to queued.

map-api enqueues a job to scrape pdfs at s3url
scrape worker takes that job from the queue and updates the existing row in jobs table. It sets page_count, page_suggestions, and sets status to scraping

Client can call progress/${job_id} and it's a pass through from map-api through Records service /maps/jobs/{id} to see the progress of scraping. When finished, the map-api will return the scraped info. It sets the status to awaiting_review

Client then confirms or discards tilesheets. POST confirm-tilesheets. The ones that are confirmed will get stored in the Records DB. the request gets passed through to the map-api and map-api updates the status to done the DB. Then a new tile job row for each page that needs to be tiled with status pending. and adds a job for the tile queue for the tiling service to start tiling.

Since this is asynchronous, the user can go do other things while everything is being processed and it is also up to the client to check on the progress.

5. I chose to do this asynchronously because I believe it is a better user experience for them not to be blocked while the files are being processed. Plus, scraping and tiling takes minutes. Making it async also makes retires and recovery possible. THe workers scale separately from the API. The queue also absorbs peaks in burst uploads.

6. The jobs table has a per lane lock where a two different workers can't process the same job. Duplicates in SQS messages don't matter because the jobs table is the single source of truth. If a worker fails and it has to redo the job, that is fine because the jobs are divided into small pieces so there will not be much wasted work.

7. The map jobs table is the single source of truth. If a worker crashes mid job, AWS will rebuild the container since I put it in a service. Initialy the SQS will wake up the worker to poll the jobs table, but the worker itself will poll the table as a fallback every 10 seconds. The status of the job don't get updated until the work is done so that worker will find that unfinished job, but the downside is that it has to start that particular job from scratch, which in the case of scraping, can be costly. We still use SQS to relive stress on the worker having to poll every 1 - 2 seconds. Since the workers are running on ECS, it has built support for scaling on SQS's ApproximateNumberOfMessagesVisible

8. When there are many users trying to scrape / tile we use a fairness algorithm so that each user gets a fair amount of computing power. To scale, we could scale vertically by getting faster CPU's so that each individual tiles can be processed faster. However, the best way would be to separate out the scrape jobs into different pages so that they can be processed in parallel. Tiling already does that.

9. We will need a sweeper for abandoned awaiting_upload rows. Instead of the client constantly poling for status one possibility is to have server side events or push notifications since we already have that infrastructure. I should also archive the rows that have finished_at that are older than 90 days.
   Currently scraping is done in parallel but not split the same way tiling is split. If a 40 page pdf is being scraped and the worker dies, it has to start from 0. Another way is to update the page_suggestions as the worker finishes scraping a page. That way the worker can always resume from the previous one.

10. One of the reasons that I even implemented a fairness alorithm was that I discovered one user's 100 page upload took up all of the processing power.

11. Currently we haven't implemented metrics and logging. But what we would need is every container's memory to be logged and set triggers for it. heart beats, and maybe number of owners waiting, and /healthz on map-api

    scrape: awaiting_upload -> queued -> scraping -> awaiting_review -> done
    tile: queued -> tiling -> ready

CREATE TABLE map_jobs(

    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type            VARCHAR(10) NOT NULL DEFAULT 'legacy' -- split| scrape | tile
    parent_job_id       UUID --tile job -> scrape job
    tilesheet_id        VARCHAR(255) --created by records service
    version_number      INT --created by records service

    upload_s3_key       VARCHAR(500) NOT NULL,
    original_filename   VARCHAR(255),
    original_file_type  VARCHAR(10),

    status              VARCHAR(50) NOT NULL DEFAULT 'queued',
    progress            VARCHAR(255) ,
    progress_pct        INT NOT NULL DEFAULT 0,
    error_message       TEXT,

    page_count          INT NOT NULL DEFAULT 1, --scraper
    page_suggestions    JSONB, --scrape: sheet number/ tile per page
    dzi_manifest_key    VARCHAR(500), --location of dzi image in s3
    image_width         INT,
    image_height        INT,

    onwer_id            VARCHAR(255), --used for fairness key
    queued_at           TIMESTAMP, --place in line
    started_at          TIMESTAMP,
    finished_at         TIMESTAMP,
    heartbeat_at        TIMESTAMP,  --worker inserts every 30 seconds
    attempts            INT NOT NULL DEFAULT 0,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

) INDEX (status, job_type, queued_at)

Fairness algorithm. owner_key - coalesce(owner_id, parent_job_id, id)

lock mechanism:
SELECT pg_advisory_xact_lock(hash('map_jobs_claim:tile'));

SELECT pg_advisory_xact_lock(hash('map_jobs_claim:' || lane)); -- one claim at a time per lane

WITH active AS ( -- how many jobs each owner has RUNNING in this lane
SELECT owner_key, COUNT(\*) AS n FROM map_jobs
WHERE status IN (running statuses) AND job_type IN (lane's types)
GROUP BY owner_key
),
candidate AS ( -- pick the next job
SELECT q.id FROM map_jobs q LEFT JOIN active a USING (owner_key)
WHERE q.status = 'queued' AND q.job_type IN (lane's types)
AND (cap IS NULL OR COALESCE(a.n,0) < cap) -- optional per-owner hard cap (off by default)
AND (NOT new_only OR a.n IS NULL) -- burst slots: only owners with NOTHING running
ORDER BY COALESCE(a.n,0), -- 1) fewest running first
q.queued_at, -- 2) then oldest in line
q.id -- 3) tie-breaker
LIMIT 1
)
UPDATE map_jobs SET status = 'scraping'/'tiling', started_at = NOW(), heartbeat_at = NOW(), attempts = attempts + 1
FROM candidate WHERE map_jobs.id = candidate.id AND map_jobs.status = 'queued'
RETURNING ...;
