# CodePulse — Code Tour (interview study guide)

Built one file at a time. All line numbers match commit `130ff11` (the Vitest commit).
Read-only: nothing in the code was changed to write this.

**Contents**
- Part 1 — The big picture
- Part 2 — File by file, in the order a request travels *(added as we go)*
- Part 4 — The hard parts *(later)*
- Part 5 — What's still not fixed *(later)*
- Part 6 — Interview tour script, hard questions, cheat sheet *(later)*

---

# Part 1 — The big picture

## 0. Three corrections before we start

1. **The shared helper is called `recordCategoryOutcome`, not `completeCategory`.**
   It lives in `worker/lib/runLifecycle.js:58`. It saves one category's result, then calls
   `advanceToAggregating` (`runLifecycle.js:91`), which is the handoff.
2. **Tests already exist.** Commit `130ff11` added 39 Vitest tests (Step 6). What is still
   missing is **CI** (there is no `.github/` folder, so nothing runs the tests automatically).
3. **The "both workers count 4 of 5" race was in a *proposed* design, not the old code.**
   - The old code (Redis hash) had a different bug: it **deleted** the hash, *then* enqueued the
     aggregator, as two steps. A crash between them lost the aggregation forever.
   - The "4 of 5" race belongs to the first idea for the Postgres version: "insert my result and
     count, inside one transaction". The final code avoids it by committing first, then counting.
   Keep these two apart in the interview. Part 4 explains both.

---

## 1. Folder structure

```
code_Pulse/
├── api/                      Express web server: the "front door" (Render Web Service)
│   ├── index.js              starts the server, wires routes, relays live events to browsers
│   ├── routes/               one file per URL group: analyze, webhook, install, repos, chat, ...
│   ├── middleware/           runs before a route: Clerk login check, GitHub signature check
│   ├── services/             helpers routes call: queue.js (start a run), octokit (GitHub), openAI, embed
│   ├── lib/prisma.js         the one shared database client
│   └── prisma/               schema.prisma (every table) + migrations/ (the SQL history)
├── worker/                   background process that does the analysis (Render Background Worker)
│   ├── index.js              starts 8 BullMQ workers + the sweeper, shuts down cleanly
│   ├── workers/              one file per job type: 5 analyses + aggregator + insights + cluster
│   ├── lib/                  shared worker logic: runLifecycle, sweeper, queues, healthScore, fetchFile
│   ├── digest/               weekly email digest on a cron timer
│   └── test/                 Vitest: unit / coordination / integration (39 tests)
├── dashboard/                Next.js website the user sees (Vercel)
│   ├── app/                  pages (one folder per URL)
│   ├── components/           UI pieces: AnalyzeUrlForm, WorkerProgress (live pipeline), charts
│   └── lib/                  api.ts (calls the API), schema.ts (types)
├── mcp/                      MCP server: lets AI tools (Claude, Cursor) query CodePulse data
├── docker-compose.yml        local Postgres with pgvector (port 5433) + Redis (port 6379)
├── CHANGES_EXPLAINED.md      your notes on Steps 0–3 and 6
└── README.md, HANDOFF.md, docs/, graphify-out/, "Claude outputs/"   docs and generated files, not app code
```

In one or two sentences each:

| Folder | What it's for |
|---|---|
| `api/` | Receives HTTP requests (from the dashboard and from GitHub), checks who you are, writes the first database row for an analysis, and puts jobs on queues. It never does the heavy analysis itself. |
| `api/prisma/` | The database design. `schema.prisma` describes every table; `migrations/` is the ordered list of SQL changes that built them. |
| `worker/` | A separate long-running program that takes jobs off the queues, analyzes the code, saves results, and computes the score. It never answers HTTP requests. |
| `worker/lib/` | The reliability code from Steps 1–3 lives here: `runLifecycle.js` (run bookkeeping + handoff), `sweeper.js` (the periodic check for stuck runs), `queues.js` (shared queue connections). |
| `dashboard/` | The website. Sends "analyze this URL", then listens for live progress and shows charts. |
| `mcp/` | A small server that exposes CodePulse data as "tools" an AI assistant can call. |

**One design point worth knowing:** the worker has no database client or GitHub client of its own.
It imports the API's: `import prisma from '../../api/lib/prisma.js'` (`worker/lib/runLifecycle.js:1`).
It's simple, but it couples the two programs: they must be deployed from the same repo.

**Screen-share warning:** there are `GITHUB_PRIVATE_KEY_PATH.pem` files in the root, `api/` and
`worker/`. They are git-ignored (good), but they are real private keys. Don't click them, or `.env`,
while sharing your screen.

---

## 2. How one analysis flows (after Steps 1–3)

```
 ┌──────────── DASHBOARD (browser) ────────────┐          ┌──── GITHUB ────┐
 │ AnalyzeUrlForm → POST /api/analyze {repoUrl}│          │ push event     │
 └──────────────────────┬──────────────────────┘          └───────┬────────┘
                        │ (Bearer token)                          │ POST /webhook (signed)
                        ▼                                         ▼
 ┌───────────────────────────── API PROCESS (Express) ─────────────────────────────┐
 │ requireClerk → routes/analyze.js           verifyGithub → routes/webhook.js      │
 │    upsert User, Repo                           upsert Repo                       │
 │         └──── fanOutPublic ────┐     ┌──── fanOut ────┘                          │
 │                                ▼     ▼                                           │
 │              services/queue.js  createRunAndEnqueue()                            │
 │   ① INSERT AnalysisRun  status = QUEUED            ──► Postgres                  │
 │   ② add 1 job to each of 5 queues, jobId = runId    ──► Redis                   │
 │      (if ② throws → mark run FAILED)                                             │
 │   ③ return { repoId, commitSha, runId } to the browser                          │
 └──────────────────────────────────────────────────────────────────────────────────┘
                                         │
      ┌───────────────┬──────────────────┼────────────────┬────────────────┐
 complexity-queue  deadcode-queue    vuln-queue     coverage-queue    drift-queue     (Redis)
      │               │                  │                │                │
      ▼───────────────▼──────────────────▼────────────────▼────────────────▼
 ┌──────────────────────────── WORKER PROCESS ─────────────────────────────────────┐
 │ Every category job runs inside withRunTracking(category, processor):            │
 │   a. read the run; if not QUEUED/RUNNING → skip (duplicate / late delivery)     │
 │   b. QUEUED → RUNNING   (conditional update: only the first worker wins)        │
 │   c. processor: fetch files from GitHub, compute → a "report"                   │
 │      (also writes FileAnalysis rows, publishes start/done progress events)      │
 │   d. recordCategoryOutcome: UPSERT CategoryResult (runId, category)  COMMITTED  │
 │      - if the LAST retry failed: INSERT a FAILED row instead                    │
 │   e. advanceToAggregating: ONE UPDATE                                           │
 │        RUNNING → AGGREGATING  only if all 5 CategoryResult rows exist           │
 │        exactly one caller gets "1 row updated" → add aggregator job (jobId=runId)│
 │                                   │                                              │
 │                           aggregator-queue                                       │
 │                                   ▼                                              │
 │ aggregator.js (job carries only { runId }):                                      │
 │   load the 5 CategoryResults from Postgres                                       │
 │   any FAILED? → mark run FAILED, stop (no snapshot)                              │
 │   computeHealthScore → UPSERT Snapshot (unique runId)                            │
 │   → insights job, cluster job (jobId = snapshot.id), upsert Findings,            │
 │     PR comment (claim first) → publish to Redis pub/sub → run SUCCEEDED          │
 │                                                                                  │
 │ sweeper.js — at startup and every 60 s: finds runs stuck in QUEUED / RUNNING /   │
 │ AGGREGATING and pushes them forward or fails them                                │
 └────────────────────────────────────┬─────────────────────────────────────────────┘
                                      │ Redis pub/sub channels:
                                      │  codepulse:worker-event, codepulse:health-update
                                      ▼
 ┌──── API PROCESS ────┐  subscriber.on('message') → io.emit(...)  (Socket.IO)
 └─────────┬───────────┘
           ▼
 ┌──── DASHBOARD ──────┐  WorkerProgress.tsx listens for 'worker-event' / 'health-update'
 └─────────────────────┘  and the page re-reads snapshots over normal HTTP
```

**The run's life as a state machine** (the `AnalysisRunStatus` enum, `schema.prisma:52`):

```
QUEUED ──first worker starts──► RUNNING ──5th result saved──► AGGREGATING ──► SUCCEEDED
   │                               │                              │
   └── enqueue failed / sweeper ───┴────── category failed ───────┴──────► FAILED
                                                        (PARTIAL exists but isn't used yet: Step 4)
```

Every arrow is a **conditional update** ("change status to X only if it is still Y").
That's why a late or duplicate job can never move a run backwards.

---

## 3. The database tables (Prisma models)

Grouped by what they're for. ★ = added or changed in Steps 1–3.

### The analysis pipeline

| Model | What one row is | Key fields | Connects to |
|---|---|---|---|
| `User` | One person. `id` = their Clerk user ID. `'system'` for pushes from unknown GitHub users. | `id`, `email`, `plan`, `githubLogin` | has many `Repo` |
| `Repo` | One GitHub repo *as seen by one user*. Two users analyzing the same repo get two rows. | `githubRepoId`, `owner`, `name`, `source` (`github_app` / `public_url` / `demo`), `installationId` | belongs to `User`; has many runs, snapshots, files, findings. **Unique `(userId, githubRepoId)`** |
| ★ `AnalysisRun` | One analysis request. The durable record that it happened, and where it is now. | `status` (enum), `commitSha`, `error`, `startedAt`, `finishedAt`, `prCommentClaimedAt` | belongs to `Repo`; has many `CategoryResult`; has at most one `Snapshot` |
| ★ `CategoryResult` | One category's outcome for one run (e.g. "vuln for run X"). Replaced the Redis hash. | `category` (enum of 5), `status` (`SUCCEEDED`/`FAILED`), `report` (JSON), `error` | belongs to `AnalysisRun`. **Unique `(runId, category)`** → max 5 rows per run |
| ★ `Snapshot` | The final result of one run: the HealthScore and the 5 headline numbers. This is what charts show. | `healthScore`, `complexity`, `vulnCount`, `deadCode`, `coverage`, `driftScore`, `runId` | belongs to `Repo`; **`runId` is unique** → one snapshot per run |
| `FileAnalysis` | The *latest* known state of one file in one repo (not history). | `complexity`, `isDead`, `driftScore`, `embedding` (a 1536-number vector) | belongs to `Repo`. **Unique `(repoId, filePath)`**, so each run overwrites it |

### Things built from a snapshot

| Model | What it stores |
|---|---|
| `Insight` | AI-written "top risks / improvements / next action" for one snapshot. `snapshotId` is unique. |
| `Finding` | One problem to triage (high complexity file, vuln, drift, dead code). Unique `(repoId, type, filePath)` so re-runs update instead of duplicating. Has `status`, `assigneeId`, comments. |
| `FindingComment` | A comment on a finding. |
| `Cluster` | A group of similar files (k-means on embeddings), with an AI label. `FileAnalysis.clusterId` points here. |
| `FunctionMetric` | Per-function complexity inside a file. |

### Settings, chat, access

| Model | What it stores |
|---|---|
| `RepoSettings` | Per-repo options: drift threshold, digest schedule, alert rules (e.g. PR comments on/off). |
| `ChatSession` / `ChatMessage` | AI chat and debate conversations about a repo. |
| `ApiKey` | Personal API keys for the MCP server. Stores only a SHA-256 hash of the key. |
| `DigestLog` | Record of each weekly digest email sent. |

### How the pipeline tables connect

```
User 1───* Repo 1───* AnalysisRun 1───* CategoryResult   (max 5, one per category)
                │            │
                │            └──1───0..1 Snapshot 1───0..1 Insight
                │                            (Snapshot.runId unique)
                ├───* Snapshot  (old snapshots from before Step 1 have runId = NULL)
                ├───* FileAnalysis ───* FunctionMetric
                ├───* Finding ───* FindingComment
                └───0..1 RepoSettings
```

**Delete rules (`onDelete`):** deleting a `Repo` deletes its runs, snapshots, files, findings
(`Cascade`). Deleting a run deletes its `CategoryResult` rows, but a snapshot only *loses its link*
(`SetNull`, `schema.prisma:102`), so a score in the chart never disappears because a run was cleaned up.

**Two things an interviewer might spot:**
- `FileAnalysis` is written *during* the run by 3 workers, before the run succeeds. A run that
  ends `FAILED` has still changed those rows. And `snapshotId` on it is never filled in.
- `Snapshot.runId` is unique, but `commitSha` is not. Analyzing the same commit twice gives two
  runs and two snapshots. That's deliberate (see Part 4, question 4).

---

## 4. Glossary

**The building blocks**

| Term | Plain meaning |
|---|---|
| **Process** | One running program. CodePulse runs two on the server: the API process and the worker process. |
| **HTTP request / route** | A message a browser sends to a URL (e.g. `POST /api/analyze`). A *route* is the code that answers one URL. |
| **Middleware** | Code that runs *before* the route, e.g. "is this user logged in?". It can stop the request. |
| **Express** | The Node.js library the API uses to define routes and middleware. |
| **Clerk / JWT** | Clerk is the login service. After login, the browser sends a signed token (a JWT). The API checks the signature and reads the user ID (`sub`) from it. |
| **Webhook** | GitHub calling *our* URL when something happens (a push). |
| **HMAC signature** | A code GitHub computes from the request body and a shared secret. We recompute it; if it matches, the request really came from GitHub. |
| **Postgres** | The main database. Everything that must survive a restart lives here. |
| **Neon** | The hosted Postgres provider used in production. |
| **pgvector / embedding** | An *embedding* is a list of 1536 numbers that captures a file's meaning. pgvector lets Postgres store them and find "closest" ones. |
| **Cosine similarity** | How alike two embeddings are: 1 = same direction, 0 = unrelated. `<=>` gives *distance*; similarity = 1 − distance. |
| **Prisma / ORM** | Prisma is an ORM: a library that turns JavaScript calls like `prisma.snapshot.upsert(...)` into SQL. |
| **Migration** | One saved SQL change to the database structure (add a table, a column, an index). Applied in order. |
| **Enum** | A column that can only hold values from a fixed list (e.g. `QUEUED`, `RUNNING`, ...). The database rejects typos. |
| **cuid** | The random-looking string IDs Prisma generates (e.g. `clx9...`). |

**Queues**

| Term | Plain meaning |
|---|---|
| **Redis** | A very fast in-memory data store. Here it holds the queues and carries pub/sub messages. It can lose data on restart; Postgres is the durable store. |
| **Queue** | A to-do list stored in Redis. One part of the system adds items; another takes them off and does them. The two never talk directly. |
| **Job** | One item on a queue: a name plus a data object (e.g. `{ runId, repoId, changedFiles }`). |
| **Worker** | Code that takes jobs from one queue and runs a function (the *processor*) on each. |
| **BullMQ** | The Node.js library that implements queues, jobs and workers on top of Redis. |
| **jobId** | A job's ID. If you add a job whose ID already exists in that queue, BullMQ **ignores** it. CodePulse uses `jobId = runId` to prevent duplicates. |
| **Attempts / backoff** | How many times BullMQ tries a failing job (5), and how long it waits between tries (exponential: about 2 s, 4 s, 8 s, 16 s). |
| **Concurrency** | How many jobs one worker runs at the same time (5 here). |
| **Stalled job** | A job whose worker died mid-job. BullMQ notices and gives it to another worker, so it **runs again**. |
| **Fan-out** | Sending one request to many workers at once (1 analysis → 5 category jobs). |
| **Handoff** | The moment the 5th category finishes and aggregation must start. The hardest part of the design. |
| **Aggregator** | The job that combines the 5 results into one HealthScore and snapshot. |
| **Sweeper** | A timer (every 60 s) that looks for runs stuck too long and pushes them forward or fails them. |
| **TTL** | "Time to live": Redis deletes the key after this long. The old results hash had a 24-hour TTL. |

**Correctness words** (the ones interviewers love)

| Term | Plain meaning |
|---|---|
| **At-least-once delivery** | The queue promises a job runs *at least* once, and sometimes twice or more (retries, stalled jobs). BullMQ works this way. |
| **At-most-once** | Do it once or not at all, never twice. Used for the PR comment: a missing comment beats a duplicate. |
| **Exactly-once** | What everyone wants and no queue can promise. You get the *effect* of it with at-least-once delivery plus idempotent handlers. |
| **Idempotent** | Doing it twice leaves things the same as doing it once. "Set status to DONE" is idempotent; "add 1 to the count" is not. |
| **Race condition** | A bug that happens only when two things run at the same moment and the result depends on who goes first. |
| **Transaction** | A group of database changes that happen all together or not at all. |
| **Commit** | The moment a transaction's changes become final and visible to others. A single statement outside a transaction commits by itself right away. |
| **READ COMMITTED** | Postgres's default *isolation level*. Each statement sees only data that was committed **before that statement started**. It does not see other people's uncommitted changes. |
| **Row lock** | When a statement updates a row, Postgres locks it. A second update of the same row **waits**, then re-checks its `WHERE` against the new version of the row. |
| **Conditional update / compare-and-set** | "Change X to B *only if* it is still A", in one statement. If someone else changed it first, 0 rows are updated. In the code: `updateMany({ where: { id, status: 'QUEUED' } ... })`. |
| **Unique constraint** | A database rule: no two rows may have the same value(s) in these columns. The database enforces it, so it can't be raced. |
| **Index** | A lookup structure that makes searching a column fast. `@@index([status, updatedAt])` lets the sweeper find stuck runs quickly. |
| **Upsert** | "Update if it exists, insert if not." |
| **`INSERT ... ON CONFLICT`** | The Postgres way to upsert in **one atomic statement**. `DO UPDATE` changes the existing row; `DO NOTHING` leaves it. |
| **P2002** | Prisma's error code for "unique constraint violated". |
| **Atomic** | Happens as one indivisible step; nobody can see it half-done. |
| **Source of truth** | The one place whose data wins when copies disagree. Here: Postgres, not Redis. |
| **Foreign key / Cascade / SetNull** | A column that points to another table's row. `Cascade` = delete me when the parent is deleted. `SetNull` = just clear the pointer. |

**Live updates**

| Term | Plain meaning |
|---|---|
| **Pub/sub** | Publish/subscribe. A sender *publishes* a message on a named channel; anyone *subscribed* gets it right then. Nothing is stored: if nobody is listening, it's gone. |
| **Socket.IO / WebSocket** | A connection that stays open between browser and server, so the server can push messages without the browser asking. |

**The analysis itself**

| Term | Plain meaning |
|---|---|
| **HealthScore** | 0–100. Starts at 100, minus weighted penalties for the 5 categories (`worker/lib/healthScore.js`). |
| **Cyclomatic complexity** | Roughly, the number of paths through code: 1 + each `if`, loop, `case`, `&&`, `||`, ... Here it is counted with regexes, not a real parser. |
| **Dead code** | Exports no other file imports. |
| **npm audit** | npm's command that checks `package-lock.json` against a database of known vulnerable packages (CVEs). |
| **lcov** | A standard text file format for test-coverage results (`LF:` lines found, `LH:` lines hit). |
| **Drift** | A file that isn't similar to anything else in the repo (max similarity below 0.72): it may not fit the architecture. |

---

## 5. Roadmap for Part 2 (the order a request travels)

| # | File | Why it's in this order |
|---|---|---|
| 1 | `dashboard/components/AnalyzeUrlForm.tsx` + `dashboard/lib/api.ts` | where the click starts |
| 2 | `api/index.js` | the request arrives; routing and middleware |
| 3 | `api/middleware/requireClerk.js` | who is this user? |
| 4 | `api/routes/analyze.js` | entry point 1: public URL |
| 5 | `api/routes/webhook.js` (+ `verifyGithub.js`) | entry point 2: GitHub push |
| 6 | `api/prisma/schema.prisma` (the Step 1–3 models) + migrations | the tables about to be written |
| 7 | `api/services/queue.js` | creates the run, fans out 5 jobs ★ |
| 8 | `worker/index.js` | the worker process starts and wires everything ★ |
| 9 | `worker/lib/runLifecycle.js` — part A: `withRunTracking` | the wrapper around every category job ★ |
| 10 | `worker/lib/fetchFile.js` + `fetchRepoTree.js` | how workers read code from GitHub |
| 11–15 | `worker/workers/complexity.js`, `deadcode.js`, `vuln.js`, `coverage.js`, `drift.js` | the 5 analyses ★ |
| 16 | `worker/lib/runLifecycle.js` — part B: `recordCategoryOutcome` + `advanceToAggregating` | the handoff ★ |
| 17 | `worker/lib/queues.js` | shared queues, `ensureAggregationEnqueued` ★ |
| 18 | `worker/workers/aggregator.js` + `runLifecycle.js` part C | score, snapshot, follow-ups ★ |
| 19 | `worker/lib/healthScore.js` | the formula ★ |
| 20 | `api/index.js` (Socket.IO relay) + `dashboard/components/WorkerProgress.tsx` | results reach the screen |
| 21 | `worker/lib/sweeper.js` | the safety net for stuck runs ★ |
| 22 | `worker/workers/insights.js` + `cluster.js` | follow-up jobs after the snapshot |
| 23 | `worker/test/` | how Steps 1–3 are proven |

★ = changed or added in Steps 1–3 (or Step 6).

---

# Part 2 — File by file

*(Sections are added here one file at a time.)*
