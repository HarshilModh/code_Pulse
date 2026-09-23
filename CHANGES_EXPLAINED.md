# CodePulse reliability changes — explained

A plain-English study guide for each step. Each section says what was wrong, what changed,
why this approach, what alternative was rejected, and what is still not fixed.

Safety net: the tag `original-before-fixes` marks the code before any of these changes.

---

## Step 0 — How one analysis worked before (no code changed)

**The flow**

1. `POST /api/analyze` ([api/routes/analyze.js](api/routes/analyze.js)) finds the latest commit, lists
   the files (keeps only the first 200, silently), upserts the `Repo`, and calls `fanOutPublic`.
   GitHub pushes (`webhook.js`) and App installs (`install.js`) call `fanOut` the same way.
2. `fanOut` ([api/services/queue.js](api/services/queue.js)) deletes a Redis hash
   `codepulse:results:{repoId}:{commitSha}` and adds one job to each of 5 queues
   (complexity, deadcode, vuln, coverage, drift) with 5 attempts and exponential backoff.
3. The worker process runs each category. Each writes `FileAnalysis` rows and builds a small report.
4. **Handoff:** every worker calls `storeWorkerResult` ([worker/resultStore.js](worker/resultStore.js)):
   `HSET` its report into the hash, `HGETALL` the hash, and if all 5 are present, `DEL` the hash.
   Whoever's `DEL` returns 1 enqueues the aggregator job with all 5 reports inside the job.
   This code is copy-pasted in all five workers.
5. The aggregator computes the HealthScore, `snapshot.create`s, enqueues insights/cluster jobs,
   upserts findings, maybe posts a PR comment, and publishes to Redis pub/sub.
6. The API relays pub/sub messages to every dashboard over Socket.IO.

**Key point:** there was no durable record that a run existed. The only state was a Redis hash
with a 24-hour expiry. Nothing could answer "what happened to the analysis I started?"

**Problems confirmed**

| # | Problem | Evidence |
|---|---------|----------|
| 1 | Handoff gap: the hash is deleted, *then* the aggregator is enqueued, as two separate steps. If the enqueue fails (crash, or even a Redis blip), the retried worker writes into a fresh empty hash and sees 1 of 5. Aggregation never happens. | `resultStore.js:18`, `complexity.js:77` |
| 2 | Duplicate snapshots: `snapshot.create` has no uniqueness rule. The aggregator job has **1 attempt** (no options passed), so duplicates don't come from normal retries. They come from stalled-job re-delivery (worker dies after `create`) and from analyzing the same commit twice. The single attempt is its own bug: one transient DB error loses the snapshot for good. | `aggregator.js:27` |
| 3 | Hidden partial results: per-file errors are caught and logged, and the job still "completes". A GitHub rate-limit 403 is thrown by the fetch helper, then swallowed per file. A failed `npm audit` reports **0 vulnerabilities** (score goes up). A missing coverage report is treated like 100% coverage. | `complexity.js:57`, `vuln.js:53`, `aggregator.js:16` |
| 4 | No tests: both `test` scripts are the npm placeholder. | `package.json` |

**Found in addition**

- **Stuck forever:** if one category fails all 5 attempts, the hash never reaches 5/5, so the run
  never aggregates and nothing reports it. Dead-code uses one `Promise.all` over 300 fetches,
  so a single error fails the whole job.
- Results are keyed by `repoId:commitSha`, not by run: re-analyzing the same commit wipes or
  mixes the earlier run's results.
- `escomplex` is a dependency but never imported; complexity is a regex heuristic.

---

## Step 1 — A saved "analysis run" with clear states

**What was wrong**

A run existed only as five loose BullMQ jobs plus a temporary Redis hash. There was no ID you
could hand back to a user, no status, and no record that survives Redis expiring or restarting.

**What changed**

- New table `AnalysisRun` ([schema.prisma](api/prisma/schema.prisma)): `id, repoId, commitSha,
  status, error, createdAt, updatedAt, startedAt, finishedAt`. `status` is a Postgres enum:
  `QUEUED → RUNNING → AGGREGATING → SUCCEEDED | PARTIAL | FAILED`.
- `fanOut` / `fanOutPublic` ([queue.js](api/services/queue.js)) now share one function that:
  1. **inserts the run row first**, then
  2. enqueues the 5 jobs with `runId` in the payload and `jobId = runId`,
  3. and if enqueueing throws, marks the run `FAILED` with the error before rethrowing.
  Doing it inside `fanOut` means all three entry points (analyze, webhook, install) get runs for free.
- `POST /api/analyze` returns `runId` alongside `repoId` and `commitSha`.
- A wrapper `withRunTracking` ([worker/lib/runLifecycle.js](worker/lib/runLifecycle.js)) is put
  around the 5 category processors in `worker/index.js`. Before running a job it:
  - skips the job if the run is already `FAILED` (or deleted);
  - moves the run `QUEUED → RUNNING` using `updateMany where status = 'QUEUED'`.
- The aggregator marks the run `SUCCEEDED` at the end, or `FAILED` in its catch.

**Why this approach**

- *Database row before queue jobs.* If we enqueued first and crashed before inserting, workers
  would process a run nobody can look up. The other order's failure (row exists, enqueue failed)
  is visible and we mark it FAILED.
- *Conditional updates (`updateMany ... where status = X`) instead of plain updates.* Five workers
  start at about the same time; only the first one's update matches a row. The rest match zero rows,
  which is harmless. The same trick makes terminal states one-way: a late or retried job can't move
  a `SUCCEEDED` run back to `RUNNING`. This is the "compare-and-set" idea, done by the database.
- *`jobId = runId`.* BullMQ ignores an `add()` whose job ID already exists in that queue, so
  enqueueing the same run twice can't create duplicate jobs. Step 3's periodic check relies on
  this. Each category has its own queue, so `runId` alone is unique; BullMQ also forbids `:` in
  custom IDs, so `"complexity:<runId>"` would have thrown.
- *An enum instead of a string.* The database rejects a typo like `'SUCEEDED'`.
- *One wrapper instead of editing five workers.* The lifecycle rules live in one file, and Step 3
  extends the same wrapper.

**Alternatives rejected**

- *Keep run state in Redis (e.g. a status field in the hash).* Redis here is a queue/cache with a
  TTL; the status endpoint (Step 5) needs a durable source of truth, and the rest of the app's
  data is already in Postgres.
- *Use BullMQ's `worker.on('active')` event to set RUNNING.* Event handlers are fire-and-forget:
  errors aren't awaited and the job doesn't wait for them. Doing it inside the processor means a
  failed status write fails (and retries) the job.

**How it was verified** (no test suite yet; that's Step 6)

A throwaway script against local Postgres + Redis checked 16 claims, all passing: run starts
`QUEUED`; 5 jobs carry `runId`; re-adding the same `jobId` doesn't duplicate; first worker sets
`RUNNING`, second is a no-op; `SUCCEEDED` can't be undone by a late job or a late failure; a
simulated Redis outage during enqueue marks the run `FAILED` and its orphan jobs are skipped;
old jobs without `runId` still run.

**Remaining limitations (fixed in later steps)**

- The Redis-hash handoff is unchanged, so the "stuck forever" and "lost aggregation" bugs are
  still there. A run that hits them stays `RUNNING` forever — but now at least that is *visible*
  in the database. (Step 3.)
- Results are still keyed by `repoId:commitSha` in Redis, not by `runId`. (Step 3 removes the hash.)
- The aggregator still has 1 attempt and `snapshot.create` still allows duplicates. (Step 2.)
- Insert-then-enqueue is two systems (Postgres, Redis), so it can't be one atomic step. If the
  process dies *between* them, the run stays `QUEUED` with no jobs. Step 3's periodic check will
  catch runs stuck in `QUEUED`.
- If enqueueing fails part-way, some category jobs may already exist. They are skipped because
  the run is `FAILED`, but they still occupy a queue slot briefly.
