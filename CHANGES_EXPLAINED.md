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

---

## Step 2 — Safe-to-repeat results and aggregation

**The key word: idempotent.** An operation is idempotent if doing it twice leaves the system
in the same state as doing it once. Queues like BullMQ are *at-least-once*: a job can run more
than once (retries, or a "stalled" job re-delivered after a worker crash). You can't make the
queue deliver exactly once, so you make every handler safe to repeat.

**What was wrong**

- Category reports lived only in a Redis hash (with a 24h expiry), and the aggregator got its
  input copied inside the job payload.
- `snapshot.create` had no uniqueness rule, so a second aggregation made a second snapshot, a
  second insights job, and possibly a second PR comment.
- The aggregator job had **1 attempt**, so one brief DB error lost the snapshot forever.

**What changed**

| Change | Where |
|---|---|
| New table `CategoryResult` with `@@unique([runId, category])`. Each worker **upserts** its report there before touching the Redis hash. A duplicate delivery overwrites its own row. | [schema.prisma](api/prisma/schema.prisma), [runLifecycle.js](worker/lib/runLifecycle.js) `saveCategoryResult` |
| `Snapshot.runId` — nullable, **unique**. The aggregator calls `upsertRunSnapshot(runId, …)` instead of `create`. | `upsertRunSnapshot` |
| The aggregator reads its input from Postgres (`loadCategoryResults`), not the job payload. If a category is missing it throws, so BullMQ retries. | [aggregator.js](worker/workers/aggregator.js) |
| Aggregator jobs now get `attempts: 5` + exponential backoff. The run is marked `FAILED` only on the **last** attempt (`isFinalAttempt`). | 5 worker handoffs, aggregator catch |
| Follow-up jobs use `jobId = snapshot.id` (insights, cluster), so a re-run aggregation can't enqueue them twice. | aggregator |
| PR comment: an **at-most-once claim** (`prCommentClaimedAt`) is written *before* posting. | `claimPrComment` |

Findings were already safe: they upsert on `(repoId, type, filePath)`. Clustering deletes and
rebuilds the repo's clusters, so repeating it is harmless.

**Why this approach**

- *Let the database enforce uniqueness.* Application code that says "check if it exists, then
  insert" is a race: two callers can both see "not there". A `UNIQUE` constraint can't be raced.
- *The Prisma `upsert` subtlety (good interview story).* With `update: {}`, Prisma runs
  `SELECT` then `INSERT` — two statements, so it can still race. With a non-empty `update`
  it sends one atomic `INSERT … ON CONFLICT ("runId") DO UPDATE`, and Postgres resolves the race.
  Measured: 20 simultaneous calls with `update: {}` → **19 failed with P2002** (unique violation;
  still 1 row, thanks to the constraint). With `upsertRunSnapshot` → **0 errors, 1 row**. The
  `update: { commitSha }` is a deliberate no-op that exists only to get the atomic statement.
- *At-least-once vs at-most-once, chosen per side effect.* Database writes are idempotent, so
  they can safely be retried (at-least-once). A PR comment is a message to a human and can't be
  un-sent, so it gets at-most-once: claim first, then post. The cost: if GitHub errors after the
  claim, that run gets no comment. A missing comment is better than duplicate spam.
- *Only the last attempt fails the run.* Otherwise attempt 1 failing would mark the run `FAILED`
  while attempts 2–5 might still succeed.
- *Postgres is the source of truth for results.* The aggregator no longer trusts a copy of the
  results inside a job payload. It re-reads them, so any retry sees the current, durable state.

**Alternatives rejected**

- *Catch P2002 and re-read the row.* Works, but it's more code, and it still makes the losing
  request do a failed insert. The atomic upsert makes the race a non-event.
- *`INSERT … ON CONFLICT DO NOTHING` in raw SQL.* Also atomic, but `DO NOTHING` returns no row,
  so we'd need a second query to get the existing `snapshot.id`. And the project rule is Prisma
  for everything except vectors.
- *A unique constraint on `(repoId, commitSha)` instead of `runId`.* That would forbid ever
  re-analyzing the same commit (e.g. after the drift threshold changes). One snapshot **per run**
  is the right unit.
- *Dedupe the aggregator job itself with `jobId = runId`.* Coming in Step 3, where the handoff is
  rewritten in one place. Step 2 makes aggregation safe *even if* it runs twice. Step 3 then makes
  it rare.

**How it was verified** (throwaway script, real Postgres + Redis, 16 checks, all pass)

Duplicate category delivery → 1 row with the latest report. Aggregation twice in a row → same
snapshot id, 1 snapshot, 1 insights job. Two aggregations at once → 1 snapshot. Missing category →
attempt 1 leaves the run `RUNNING`, attempt 5 marks it `FAILED`. 3 simultaneous PR-comment claims →
exactly 1 wins. 20 simultaneous snapshot upserts → 0 errors (control group: 19 of 20 fail). Legacy
jobs without `runId` still work. Step 1's 16 checks were re-run and still pass.

**Remaining limitations**

- **The handoff is still the Redis hash**, so "lost aggregation" and "stuck forever" are still
  possible (Step 3). Results are now safely in Postgres, which is what Step 3 needs.
- BullMQ's `jobId` dedupe only works while the old job is still stored in Redis. These queues
  don't set `removeOnComplete`, so completed jobs are kept and dedupe holds. If someone later adds
  `removeOnComplete`, a re-run could enqueue insights again. The `Insight.snapshotId` unique rule
  would then make that second job fail instead of duplicating data.
- The at-most-once PR comment can be lost if GitHub fails right after the claim.
- The 5 workers still create a new BullMQ `Queue` (a Redis connection) on every handoff (Step 3).

---

## Step 3 — A reliable handoff (and the "stuck forever" fix)

**What was wrong**

The "handoff" is the moment the fifth category finishes and aggregation must start. It used a
Redis hash: `HSET` my report → `HGETALL` → if 5/5, `DEL` the hash → enqueue the aggregator.

1. **Lost aggregation.** `DEL` and "enqueue" were two separate steps. If the enqueue failed
   (crash, Redis blip), the retried worker wrote into a *fresh, empty* hash, saw 1/5, and
   aggregation never happened.
2. **Stuck forever.** A category that failed all 5 attempts never wrote to the hash, so the run
   waited for it forever. Nothing timed out and nothing told anyone.
3. The same 10 lines were copy-pasted into all five workers, and each handoff opened a new Redis
   connection that was never closed.

**The two options compared**

| | (a) BullMQ Flows | (b) Database-driven *(chosen)* |
|---|---|---|
| How | A parent "aggregate" job with 5 child jobs. BullMQ runs the parent when all children complete. | Each category commits its result to Postgres, then runs one conditional `UPDATE` that moves the run `RUNNING → AGGREGATING` only if all 5 rows exist. The one caller that gets "1 row updated" enqueues aggregation with `jobId = runId`. A sweeper covers crashes. |
| Lost handoff (crash between steps) | ✅ Handled inside Redis by BullMQ's Lua scripts: the child completing and the parent's dependency count update are atomic. | ✅ The state lives in Postgres. If the process dies after advancing but before enqueueing, the run sits in `AGGREGATING`; the sweeper re-enqueues it, and `jobId = runId` makes that a no-op if the job already exists. |
| Child fails all retries | ⚠️ By default the parent waits **forever** (the exact bug we're fixing). Needs `failParentOnFailure` (run fails) or `ignoreDependencyOnFailure` (run continues), set per child. | ✅ The last attempt writes a `FAILED` category row, which counts toward "5 of 5". The run finishes. |
| Worker killed mid-job / job lost from Redis / job hangs | ⚠️ Stalled-job detection covers a killed worker. A job deleted from Redis or hung forever leaves the parent waiting. | ✅ The sweeper checks the BullMQ state of each missing category: dead or missing → `FAILED`; still pending after 60 min → timed out. |
| Where the truth lives | Redis (job tree). The status endpoint (Step 5) would have to read BullMQ internals. | Postgres. The same table serves the handoff, the sweeper and the status endpoint. |
| Redis data loss (restart without persistence, eviction) | ❌ The job tree, and with it the knowledge of which children finished, is gone. | ✅ Results and run state survive. The sweeper notices the missing jobs and ends the run. |
| Code | Less of it; the coordination is BullMQ's. | More of it (handoff SQL + sweeper) and we own it. |

**Recommendation: (b).** Flows is a fine tool and handles the atomic handoff for free. But our
two worst bugs are "a child that never completes" and "state that disappears". Flows needs extra
configuration for the first and can't help with the second. We already needed the run state in
Postgres for Steps 1, 4 and 5, so (b) builds on it instead of creating a second source of truth.

**What changed**

- **The five workers only compute.** They return their report; the handoff code is deleted from
  all five, and `worker/resultStore.js` (the Redis hash) is gone.
- **The wrapper `withRunTracking(category, processor)`** ([runLifecycle.js](worker/lib/runLifecycle.js)) now:
  - skips work for runs no longer `QUEUED`/`RUNNING` (duplicate or late delivery). If the run is
    `AGGREGATING`, it also makes sure the aggregation job exists (cheap self-healing);
  - on success → `recordCategoryOutcome(…, { report })`;
  - on failure of the **last** attempt → `recordCategoryOutcome(…, { error })`, then rethrows so
    BullMQ still shows the job as failed. **This is the "stuck forever" fix.**
- **`recordCategoryOutcome`** saves the row and then calls `advanceToAggregating`:
  - success *overwrites* (upsert); failure *never overwrites* (`createMany … skipDuplicates` =
    `INSERT … ON CONFLICT DO NOTHING`), so if one delivery succeeded, a failing duplicate can't
    erase it;
  - results **freeze** once the run leaves `RUNNING`: a late delivery can't change the inputs of
    a snapshot that already exists.
- **`advanceToAggregating`**, the handoff, is one statement:
  ```sql
  UPDATE "AnalysisRun" SET status = 'AGGREGATING', "updatedAt" = $now
  WHERE id = $runId AND status = 'RUNNING'
    AND (SELECT COUNT(*) FROM "CategoryResult" WHERE "runId" = $runId) = 5
  ```
- **The aggregator job carries only `{ runId }`** and reads everything from Postgres, so the
  sweeper can re-enqueue it knowing nothing else. If any category is `FAILED`, the aggregator ends
  the run as `FAILED` with an error naming the categories (Step 4 turns this into `PARTIAL`).
- **The sweeper** ([sweeper.js](worker/lib/sweeper.js)), started by `worker/index.js`, runs once at
  startup and then every 60 seconds:

  | Stuck in | For | Action |
  |---|---|---|
  | `AGGREGATING` | 2 min | Aggregation job missing → enqueue it. Job `failed` (e.g. crashed on its last attempt) → run `FAILED`. Waiting/active → leave it. |
  | `RUNNING` | 2 min | For each category with no row: job missing/failed → record `FAILED`. Then run the handoff `UPDATE` itself (covers "saved but died before the UPDATE"). |
  | `RUNNING` | 60 min | Categories still pending are recorded as timed out. |
  | `QUEUED` | 10 min | If **no** category jobs exist (API died between insert and enqueue) → run `FAILED`. A long backlog is left alone. |

- **One shared `Queue` per name** ([queues.js](worker/lib/queues.js)), created lazily and closed on
  shutdown. This fixes the connection leak.

**Why the conditional `UPDATE` is correct (the part to be able to explain)**

Your first idea was "in one transaction, check whether all five exist, then update". Under
Postgres's default isolation (READ COMMITTED), a transaction can't see another's *uncommitted*
insert. Two workers finishing together would each count 4 of 5, and nobody would advance the run.
The fix is ordering:

1. **Commit the result first**, *then* run the `UPDATE`. Whichever worker commits **last** starts
   its `UPDATE` after every other result is committed, so it counts 5. Somebody always advances.
2. **Two workers can both count 5.** The first `UPDATE` locks the row and sets `AGGREGATING`. The
   second waits for that lock, then Postgres **re-checks the `WHERE` on the new version of the
   row**, sees `status` is no longer `RUNNING`, and updates 0 rows. Exactly one caller gets `1`.
3. Only that caller enqueues. If it dies before enqueueing, the sweeper finds the run in
   `AGGREGATING` and enqueues it.

This is the same compare-and-set idea as Step 1, with the count folded into the condition.

**Alternatives rejected**

- *BullMQ Flows* — see the table.
- *`SELECT … FOR UPDATE` on the run row inside a transaction.* Also correct (it serializes the
  five completions), but it holds a lock across several statements and needs an interactive
  transaction. The single conditional statement gets the same safety with no explicit lock.
- *Use SERIALIZABLE isolation.* The database would detect the conflict and abort one transaction,
  and we'd then need retry-on-serialization-failure logic. More moving parts for the same result.
- *A BullMQ repeatable job for the sweeper, so only one process sweeps.* Every sweeper action is
  conditional or idempotent, so several processes sweeping at once is harmless. `setInterval` is
  simpler.
- *Mark the run `PARTIAL` and still score it when a category fails.* That needs a product decision
  about how to score a missing category (Step 4). Until then, `FAILED` with a clear error is honest,
  and it's strictly better than hanging forever.

**How it was verified** (throwaway script, **real BullMQ workers** + Postgres + Redis; only the
category processors are fakes, so no GitHub calls. 24 checks, all pass)

| Scenario | Result |
|---|---|
| A. Happy path through the real `fanOutPublic` | `SUCCEEDED`, 5 rows, 1 snapshot, aggregator `jobId = runId` |
| B. vuln fails all 3 attempts | attempted exactly 3×, recorded `FAILED`, run `FAILED` with "vuln (vuln boom)", no snapshot |
| C. vuln fails attempts 1–2, succeeds on 3 | run `SUCCEEDED` (early failures don't end the run) |
| D. All 5 categories finish at the same instant, ×20 | exactly one advancer and one aggregation job, 20/20 |
| E. Advanced to `AGGREGATING`, crashed before enqueue | sweeper enqueues, run recovers to `SUCCEEDED` |
| F. All 5 saved, nobody ran the handoff (no jobs exist) | sweeper runs the handoff itself, `SUCCEEDED` |
| G. drift's job vanished from Redis | sweeper records drift `FAILED`, run `FAILED` |
| H. drift's job still pending | left alone at 5 min; timed out at 61 min |
| I. Category re-delivered after `SUCCEEDED` | skipped; frozen result untouched; still 1 snapshot |
| J. `QUEUED` with no jobs | stale one → `FAILED`; fresh one untouched |

The real `worker/index.js` was also booted and sent SIGTERM: it started, swept, and exited cleanly.

**Remaining limitations**

- **One failed category fails the whole run (no snapshot).** Step 4 will make this `PARTIAL`
  with a score over the categories that did finish, once you decide how to score a missing one.
- **Timeouts are guesses.** 60 minutes for a category, 2 minutes before the sweeper looks. A
  genuinely slow run on a huge repo could be timed out; the numbers are in `DEFAULT_LIMITS`.
- **The sweeper can't stop a hung job.** It marks the category timed out and the run moves on,
  but the hung job keeps its worker slot until the process restarts. The root cause (GitHub calls
  with no timeout) isn't fixed.
- **Jobs enqueued before this deploy** (no `runId`) are analyzed but never aggregated. Deploy with
  empty queues.
- **Small window in "results freeze":** the status check and the write are two statements, so a
  delivery that passes the check just as the run advances could still overwrite its row. Every
  attempt analyzes the same commit, so the data would be equivalent.
- The sweeper handles up to 50 runs per status per tick. A huge backlog of stuck runs clears over
  several ticks.

---

## Step 6 — Real tests

**What was wrong:** both `test` scripts were `echo "Error: no test specified" && exit 1`. Every
claim in Steps 1–3 was checked only by throwaway scripts.

**What changed**

- **Vitest** in `worker/` (`npm test`). `api/`'s `npm test` runs the same suite, which covers
  `api/services/queue.js` too. One suite, one setup.
- **The score formula moved into a pure function**, [worker/lib/healthScore.js](worker/lib/healthScore.js),
  so it can be tested without a database. One fix on the way: a report missing `avgComplexity`
  used to make the whole score `NaN`; it now counts as 0.
- **Tests can never touch real data.** They use their own database `codepulse_test` and Redis DB
  number 15. `test/testEnv.js` refuses to run unless the database is on a local host and its name
  ends in `_test`, and Redis isn't db 0. `test/setup.js` then asks Postgres which database it is
  *actually* connected to, in case an `.env` file won. Checked: pointing the tests at the dev DB,
  at Redis db 0, or at a Neon hostname aborts before anything runs.
- The test DB is migrated with the **same `prisma migrate deploy`** that production uses, before
  the tests run, so the schema under test is the real one.

**The 39 tests, in three layers**

| Layer | File | Infra | What it covers |
|---|---|---|---|
| Unit (14) | `test/unit/healthScore.test.js` | none | Perfect → 100, worst → 0; complexity cap at avg 10; vuln points (critical 10 / high 5 / moderate 2, low ignored) and cap; coverage 0% / 50% / missing; dead code / drift weights; missing `avgComplexity` isn't NaN; 1,000 random inputs stay within [0, 100] |
| Coordination (21) | `test/coordination/handoff.test.js` | **real Postgres**, fake queue | All **120** completion orders of the 5 categories hand off exactly once, only after the 5th. 5 simultaneous completions × 25: exactly one advancer. Failure before the last attempt records nothing; a later success counts; the final failure records `FAILED` and the run ends `FAILED`, not stuck. Duplicates, sequential and concurrent: 5 rows, 1 handoff. A failing duplicate can't overwrite a success. A duplicate after the finish is skipped. A slow duplicate that finishes after the handoff can't change frozen results. Aggregation twice, sequential and concurrent: 1 snapshot, 0 errors, 1 insights job. Only the final aggregator attempt fails the run. PR-comment claim: 1 winner of 10. Sweeper: all 5 stuck situations, plus sweeping twice is a no-op. |
| Integration (4) | `test/integration/pipeline.test.js` | **real Postgres + Redis + BullMQ workers**, real API fan-out, real aggregator | Every category job delivered twice → 1 snapshot, 5 results, 1 insights job. Aggregation re-delivered after success plus late category duplicates → still the same single snapshot. Real BullMQ ignores a duplicate `jobId`. A category failing all 3 real retries → run `FAILED`, BullMQ `attemptsMade = 3`. |

**Why a fake queue but a real database for coordination?** The races we care about are in SQL:
the conditional `UPDATE`, `ON CONFLICT`, row locks. A mocked Prisma would have "passed" the
broken `update: {}` upsert from Step 2. The queue, on the other hand, only needs one behavior
(ignore a duplicate `jobId`), and faking it lets a test decide exactly which job finishes when,
or pretend a job died. The integration test then checks that real BullMQ really behaves the way
the fake assumes.

**Do the tests catch the real bugs? (mutation check)** Each original bug was put back on purpose
and the suite re-run. The files were restored afterwards and their checksums compared.

| Bug re-introduced | Tests failing |
|---|---|
| `snapshot.create` instead of upsert (duplicate snapshots) | 4 |
| Final attempt doesn't record `FAILED` (stuck forever) | 2 |
| Handoff `UPDATE` without `status = 'RUNNING'` (double handoff) | 1 |
| Upsert with `update: {}` (SELECT-then-INSERT race) | 1 |
| Run advanced but aggregation never enqueued (lost aggregation) | 11 |
| No result freeze after handoff | 1 *(0 at first — see below)* |

The last row taught something: the first version of the suite did **not** catch it. The existing
"duplicate after finish" test is stopped by the wrapper's entry check, so it never reaches the
freeze. I added a test with a slow duplicate that starts while the run is `RUNNING` and finishes
after the snapshot exists. Lesson: a passing test only counts if it fails when the code is wrong.

**What these tests prove**

- The coordination logic (handoff, idempotent writes, final-attempt failure, sweeper decisions)
  behaves correctly for every completion order, for concurrent completions, and for duplicates.
- Against real Postgres + Redis + BullMQ, duplicate delivery doesn't create duplicate snapshots,
  and a category that exhausts its retries ends the run instead of hanging.
- The score formula matches the documented weights, caps and edge cases.
- Each original bug, if re-introduced, is caught.

**What they do NOT prove (be upfront about this)**

- **The five analyses themselves are untested.** Complexity (a regex heuristic), dead-code
  detection, `npm audit` parsing, lcov parsing and drift embeddings are replaced by fakes.
  Nothing checks that they produce *correct* numbers.
- **No real process crash.** "Crashed between advance and enqueue" is simulated by putting the
  database in that state and running the sweeper. No test kills a worker mid-job with SIGKILL, so
  BullMQ's stalled-job detection is assumed, not tested.
- **The sweeper's real BullMQ states are only partly tested.** Coordination tests use fake states
  (`failed`, `active`, missing). The integration test uses real BullMQ for retries and dedupe, but
  not for "stalled more than allowable limit".
- **Concurrency is "many promises in one Node process".** They share one Prisma connection pool,
  so real parallel transactions do happen in Postgres. But this isn't several worker *processes*
  on several machines.
- **No GitHub, no HTTP routes, no Socket.IO, no dashboard.** `POST /api/analyze` isn't exercised
  through Express, only the `fanOutPublic` function it calls.
- **Timing thresholds** (2 / 10 / 60 minutes) are tested by passing a fake `now`, not by waiting.
- Passing on a laptop and in CI doesn't prove behavior under production load or with Neon's
  pgBouncer pooling.

**How to run**
```bash
docker compose up -d        # Postgres on 5433, Redis on 6379
cd worker && npm test       # creates/migrates codepulse_test, then runs all 39 tests (~6–12 s)
```
