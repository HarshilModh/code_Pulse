# CodePulse: A Plain-English Guide to the Whole Codebase

A study guide for explaining **CodePulse, my personal student project**, in a technical interview, possibly while sharing my screen. It is built one part at a time.

- **What kind of project this is:** a solo learning project, built with help from AI coding tools. It's designed to *look like* a real SaaS product (login, billing page, GitHub App, deployment targets), but it has no real users. Its purpose is to show that I can design and explain a multi-service system. The guide judges it on that basis.
- **Code version:** every line number matches commit `130ff11` ("test: add Vitest suite").
- **Read-only:** nothing in the code was changed to write this guide.
- **Secrets:** `.env`, `.env.local` and the `.pem` file were never opened. They are only described.
- **Markers:**
  - 💡 = a limitation worth knowing, with a one-line way to talk about it.
  - 🎤 = likely to come up in the interview, or something to avoid clicking during a live demo.

| Part | Topic | Status |
|---|---|---|
| 1 | The map | ✅ written |
| 2 | The three ways an analysis starts | ✅ written |
| 3 | One analysis, start to finish | ✅ written |
| 4 | Each analysis, explained + the score formula | ✅ written |
| 5 | The database (merged with 8) | ✅ written |
| 6 | Live updates, dashboard, MCP server (merged with 7) | ✅ written |
| 7 | Login, permissions, security (in 6 + 7) | ✅ written |
| 8 | Reliability (in 5 + 8) | ✅ written |
| 9 | Tests and running it | ✅ written |
| 10 | Interview prep | ✅ written |

## How to talk about the weak spots

Interviewers don't expect a student project to be finished or flawless. They want to see that **you know where its edges are and why**. For every limitation in this guide, use the same three-part answer:

> **"Here's what it does now → here's why that's fine for this project → here's what I'd change if it were real."**

Example: *"Complexity is a regex approximation, not a real parser. That was enough to get the pipeline working end to end. If I took it further, I'd swap in a proper AST-based tool per function."*

This turns every weak spot into a sign that you understand the system well.

---

# Part 1: The Map

## 1.1 What CodePulse does (5 sentences)

1. CodePulse is a **personal full-stack project** that gives a GitHub repository one **health score from 0 to 100**, and keeps a history of that score every time the code is analyzed.
2. Code gets into it in three ways: you paste a public GitHub URL, you install its **GitHub App** (GitHub then notifies CodePulse on every push), or you load a ready-made **demo** repo.
3. Each analysis is split into **five independent checks**: complexity, known vulnerabilities in dependencies, unused exports ("dead code"), test coverage, and "architectural drift". They run in parallel in a separate **worker** process, and the results are combined into one weighted score.
4. On top of the numbers it adds AI features (a chat that can read your code, a root-cause investigator, a two-sided debate, a codebase tour, auto-generated insights, and a map of file clusters), a list of **findings** to triage, and an **MCP server** so AI assistants like Claude Desktop can query the same data.
5. The imagined user is a developer on a **JavaScript/TypeScript project on GitHub**. The real goal of building it was to practise the hard parts of backend engineering: job queues, coordinating parallel workers, vector search, live updates, and third-party integrations.

💡 Every check only understands `.js/.jsx/.ts/.tsx` files and npm's `package-lock.json`. 🎤 During a demo, analyze a JS/TS repo. A Python repo would get a meaningless, near-perfect score.

## 1.2 Words you will need

Each term is explained once here, then used freely.

| Term | Plain meaning | Everyday comparison |
|---|---|---|
| **API** | A program that waits for requests over HTTP and sends back answers (usually JSON). Here: `api/`. | A restaurant counter: you order, it hands you food. |
| **Endpoint / route** | One specific address the API answers, like `POST /api/analyze`. | One item on the menu. |
| **Middleware** | A function that runs *before* the route, e.g. to check login. It can let the request through or stop it. | The bouncer at the door. |
| **Queue** | A list of jobs waiting to be done, stored in Redis. | The ticket rail in a kitchen. |
| **Job** | One unit of work in a queue, with some data attached (e.g. "analyze complexity for run X"). | One order ticket. |
| **Worker** | A long-running program that takes jobs off a queue and does them. Here: `worker/`. | A cook who takes tickets off the rail. |
| **Redis** | A very fast in-memory database. Here it holds the queues and passes live messages. | A whiteboard: fast, but not a filing cabinet. |
| **BullMQ** | A Node.js library that builds reliable job queues on top of Redis (retries, delays, job states). | The kitchen's ticket system. |
| **PostgreSQL (Postgres)** | The main, permanent database. Tables, rows, SQL. | The filing cabinet. |
| **pgvector** | A Postgres add-on that can store lists of numbers ("vectors") and find the most similar ones. | A librarian who finds "books like this one". |
| **Embedding** | A list of 1,536 numbers that captures the *meaning* of a piece of text. Similar code gets similar numbers. | GPS coordinates for meaning: close points mean similar content. |
| **Cosine similarity** | A score from about -1 to 1 for how alike two embeddings are (1 = same direction). pgvector's `<=>` gives *distance*, so similarity = `1 - distance`. | How closely two arrows point the same way. |
| **Prisma** | An **ORM** (Object-Relational Mapper): lets you write `prisma.repo.findMany()` in JavaScript instead of raw SQL. The table list lives in `schema.prisma`. | A translator between JavaScript and SQL. |
| **Migration** | A saved SQL file that changes the database structure (add a table, add a column). Applied in order. | A dated renovation plan for a building. |
| **Webhook** | GitHub calling *your* server when something happens (e.g. a push). | A doorbell GitHub rings. |
| **GitHub App** | An official integration a user installs on their repos. It gets its own short-lived access tokens. | A contractor with a keycard that expires every hour. |
| **Installation ID** | The number GitHub gives one install of the App on one account. Needed to get tokens. | The keycard's serial number. |
| **Octokit** | GitHub's official JavaScript library for calling the GitHub API. | GitHub's phone line. |
| **HMAC signature** | A code GitHub computes from the request body plus a shared secret. We recompute it to prove the request really came from GitHub. | A wax seal only the real sender can make. |
| **JWT** | "JSON Web Token": a signed login pass. Clerk gives the browser one; the API checks the signature. | A wristband at a festival. |
| **Clerk** | A hosted login service. It handles sign-up, passwords, GitHub login, and issues JWTs. | Outsourced security desk. |
| **Socket.IO** | A library for a two-way, always-open connection between browser and server, so the server can *push* updates. | A phone call instead of sending letters. |
| **Pub/sub** | "Publish/subscribe": one program shouts a message on a channel; every subscriber hears it. Redis supports this. | A radio station and its listeners. |
| **SSE** | "Server-Sent Events": the server streams text to the browser over one long HTTP response. Used for AI chat tokens. | A news ticker. |
| **MCP** | "Model Context Protocol": a standard way for AI assistants to call tools in other apps. | A universal power socket for AI tools. |
| **Idempotent** | Doing it twice has the same effect as doing it once. | Pressing a lift button twice doesn't call two lifts. |
| **cuid** | The random-looking string IDs Prisma creates, like `clx9...`. | A ticket number. |

## 1.3 The folder structure

The repo is a **monorepo**: several separate programs in one Git repository. Each has its own `package.json` and `node_modules`.

```
code_Pulse/
├── api/          Express server: HTTP routes + Socket.IO. The "front door".
├── worker/       BullMQ worker process: does the actual analysis.
├── dashboard/    Next.js web app the user sees.
├── mcp/          MCP server so AI assistants can query CodePulse.
├── docs/         One image for the README.
├── docker-compose.yml, .env.example, README.md, CLAUDE.md, ...
```

It's **designed to be deployed** like a real product: API and worker as two Render services, dashboard on Vercel, Postgres on Neon. For the interview, you'll most likely run it **locally** (Part 9).

### API (`api/`), the Express server

| File | What it is for |
|---|---|
| `api/index.js` | **Starts everything on the API side.** Creates Express + Socket.IO, reads request bodies, mounts every route, and listens to Redis pub/sub to forward live events to browsers. |
| `api/package.json` | API dependencies. `"type": "module"` means ESM (`import`/`export`). 💡 Lists `nodemailer` and `@prisma/config`, which nothing imports (leftovers). |
| `api/lib/prisma.js` | Creates **one shared Prisma database client** and reuses it (a "singleton"). The worker and MCP server import this same file. |
| `api/middleware/requireClerk.js` | **Login check.** Reads `Authorization: Bearer <token>`, verifies it with Clerk, and sets `req.userId`. |
| `api/middleware/verifyGithub.js` | **Webhook check.** Recomputes the HMAC-SHA256 signature and compares it in constant time. |
| `api/routes/webhook.js` | `POST /webhook`: GitHub **push** events. Finds or creates the repo, then starts an analysis. |
| `api/routes/analyze.js` | `POST /api/analyze`: **paste-a-URL** analysis of a public repo. |
| `api/routes/install.js` | `GET /install/callback`: where GitHub sends the user after **installing the App**. Saves the repos, then starts an analysis for each. (Mounted at `/install`, not `/api/install` as CLAUDE.md says.) |
| `api/routes/demo.js` | `POST /api/demo/fork`: copies a pre-seeded demo repo and its latest snapshot to the user. Runs **no** analysis. |
| `api/routes/repos.js` | `GET /api/repos` (your repos) and `GET /api/repos/:repoId/snapshots` (score history). Also a public `/:owner/:name` lookup. |
| `api/routes/insights.js` | `GET /api/snapshots/:id/insights`: the AI summary for one snapshot, or `202 pending`. |
| `api/routes/chat.js` | `POST /api/repos/:id/chat`: streaming AI chat with tools, plus saved chat history. |
| `api/routes/Agents/root-cause.js` | Streaming AI agent: "why did this metric drop?" (The folder is `Agents` with a capital A; CLAUDE.md says `agents`.) |
| `api/routes/Agents/debate.js` | Streaming AI debate: a "pro" and a "con" persona argue for 3 rounds. |
| `api/routes/Agents/tour.js` | One-shot AI JSON: a 5-step codebase tour. |
| `api/routes/findings.js` | List findings, change a finding's status, add comments. |
| `api/routes/files.js` | "Files similar to this one" (pgvector) and a streaming AI "explain this file". |
| `api/routes/settings.js` | Get/update per-repo settings (drift threshold, digest emails, alert rules). |
| `api/routes/apiKeys.js` | Create/list/delete personal API keys for the MCP server. Only a SHA-256 **hash** of the key is stored. |
| `api/routes/clusters.js` | Data for the cluster map page. |
| `api/routes/badge.js` | Draws an SVG "health: 87" badge for READMEs. 💡 Not reachable at the moment (see 1.8). |
| `api/routes/stripe.js` | Stripe checkout (test mode) and payment webhook. 💡 The webhook isn't reachable (see 1.8). |
| `api/routes/search.js` | Global ⌘K search. 💡 **Switched off**: the line is commented out at `api/index.js:78`. |
| `api/routes/integrations/pr.js` | Toggle for PR comments. 💡 Imported but not mounted (`api/index.js:26`). |
| `api/routes/index.js` | 💡 Leftover: an alternative route setup (`constructMethod`) that nothing calls. |
| `api/services/queue.js` | **Where analyses begin.** `fanOut` / `fanOutPublic` insert an `AnalysisRun` row, then add one job to each of the 5 queues. |
| `api/services/octokit.js` | GitHub **App** login (reads the private key `.pem` file), plus "get file" and "get file tree". |
| `api/services/publicOctokit.js` | GitHub client **without** the App: anonymous or with an optional personal token. Used for public URLs and demo repos. |
| `api/services/embed.js` | Turns text into a 1,536-number embedding with OpenAI `text-embedding-3-small`. |
| `api/services/openAI.js` | `chatStream`: the AI tool-calling loop used by chat and agents. `chatJSON`: one-shot "reply in JSON". |
| `api/services/tools.js` | **The 7 AI tools** (find repo, search code, metrics, history, findings, read file, diff). Shared by the chat *and* the MCP server. |
| `api/services/prComment.js` | Posts a GitHub **Check Run** and PR comments with the score. Called from the worker's aggregator. |
| `api/services/rag.js` | 💡 Leftover: `retrieveContext` is never imported. (`tools.js` has its own copy of the same query.) |
| `api/services/notify.js` | 💡 Leftover: never used. The workers publish to Redis directly instead. |

### Worker (`worker/`), the BullMQ background process

| File | What it is for |
|---|---|
| `worker/index.js` | **Starts all 8 BullMQ workers** (5 checks + aggregator + insights + cluster), the sweeper, and the email digest schedule. Handles graceful shutdown. |
| `worker/package.json` | Worker dependencies. 💡 Lists `escomplex`, `esprima` and `ts-prune`, but **none of them are imported**. They're from an earlier plan. |
| `worker/lib/runLifecycle.js` | **The coordination brain.** Wraps each check, saves its result, and runs the "all five done?" handoff to aggregation. The most impressive file to show. |
| `worker/lib/sweeper.js` | **Safety net.** Every 60 seconds it finds analysis runs stuck by crashes or lost jobs and pushes them forward or fails them. |
| `worker/lib/queues.js` | One shared Queue object per queue name, and `ensureAggregationEnqueued` (safe to call many times). |
| `worker/lib/healthScore.js` | **The score formula**, as a pure function (no database, no network), so it is easy to test. |
| `worker/lib/fetchFile.js` | Gets one file from GitHub the right way: App token for App repos, public client otherwise. |
| `worker/lib/fetchRepoTree.js` | Same idea, but lists every file path in the repo. |
| `worker/workers/complexity.js` | Check 1: complexity. 💡 Uses a **regex count** of `if/for/while/&&/...`, not the `escomplex` parser the README mentions. |
| `worker/workers/vuln.js` | Check 2: vulnerabilities. Writes the repo's `package-lock.json` to a temp folder and runs `npm audit --json`. |
| `worker/workers/deadcode.js` | Check 3: dead code. 💡 **Regex** matching of `export`/`import` names, not `ts-prune`. |
| `worker/workers/coverage.js` | Check 4: coverage. Looks for an `lcov.info` file *committed in the repo*. Most repos don't commit one. |
| `worker/workers/drift.js` | Check 5: drift. Embeds each file and asks pgvector how similar it is to the repo's other files. |
| `worker/workers/aggregator.js` | Runs once all five checks are done. Computes the score, saves the **Snapshot**, creates findings, queues insights and clustering, may post a PR comment, and sends live updates. |
| `worker/workers/insights.js` | Asks `gpt-4o-mini` for "top 3 risks + next action" for a snapshot. |
| `worker/workers/cluster.js` | Groups files into 4 clusters by embedding (k-means) and names each cluster with GPT. |
| `worker/digest/cron.js` | Schedules daily and weekly digest emails (9am). |
| `worker/digest/sendDigest.js` | Builds and sends one repo's digest email through Resend. |
| `worker/digest/runNow.js` | Manual script to send all digests immediately (for testing). |

💡 **Shared code between API and worker:** the worker imports files straight out of `api/` (`../../api/lib/prisma.js`, `../../api/services/octokit.js`, and others). That's simple and avoids copy-pasting. The trade-off: the two can't be deployed fully independently, and the worker needs the GitHub `.pem` key even when you only analyze public URLs, because `octokit.js:16` reads that file as soon as it's imported. *In a bigger project: move shared code into a small `shared/` package.*

### Dashboard (`dashboard/`), Next.js 16 + React 19

| File / folder | What it is for |
|---|---|
| `dashboard/app/layout.tsx` | The shell around every page: Clerk login provider, TanStack Query provider, top nav, ⌘K palette. |
| `dashboard/proxy.ts` | Next.js middleware (Next 16 renamed "middleware" to "proxy"). Every page except `/`, `/pricing`, and sign-in/up **requires login**. |
| `dashboard/lib/api.ts` | **All HTTP calls to the API** in one place. Attaches the Clerk token as `Authorization: Bearer ...`. |
| `dashboard/lib/schema.ts` | Zod schemas + TypeScript types for API responses (checks the data's shape at runtime). |
| `app/page.tsx` | Marketing-style landing page (1,156 lines, mostly design). |
| `app/dashboard/page.tsx` | Your repo list, plus "Analyze URL", "Try demo", and "Install GitHub App". |
| `app/repos/[id]/page.tsx` | **The main per-repo page:** score, trend chart, live pipeline, insights, chat, root-cause agent, tour. 🎤 The best page to demo. |
| `app/repos/[id]/chat`, `debate`, `findings`, `files/[...path]`, `settings`, `map` | Full-page chat, debate, per-repo findings, one-file detail, repo settings, cluster map. |
| `app/findings/page.tsx` | Findings across all your repos. |
| `app/settings/api-keys/page.tsx` | Create and revoke MCP API keys. |
| `app/[owner]/[name]/page.tsx` | "Public" repo page. 💡 Doesn't load today (see 1.8). |
| `app/pricing/page.tsx` | Plans + Stripe checkout button (a demonstration of a Stripe integration, not real billing). |
| `app/docs/mcp/page.tsx` | How to connect the MCP server. |
| `app/test/page.tsx` | 💡 Leftover debug page that logs Clerk state to the console. |
| `components/WorkerProgress.tsx` | **The only Socket.IO client.** Shows the 5 checks live and refreshes data when the score arrives. 🎤 Great to show live. |
| `components/HealthTrend.tsx`, `FileHeatmap.tsx`, `DriftScatter.tsx` | Charts. 💡 `FileHeatmap` actually draws one cell per **snapshot**, not per file. |
| `components/ChatPanel.tsx`, `RootCauseAgent.tsx`, `CodebaseTour.tsx`, `InsightCards.tsx` | The AI panels on the repo page. |
| `components/FindingCard.tsx` | One finding with status buttons and comments. |
| `components/ClusterGraph.tsx` | D3 force-directed graph for the cluster map. |
| `components/CommandPalette.tsx`, `GlobalSearchBar.tsx` | ⌘K search. 💡 Calls an endpoint that is switched off (see 1.8). |
| `components/AnalyzeUrlForm.tsx`, `DemoRepoButton.tsx`, `InstallGithubApp.tsx` | The three "get started" buttons. |

### MCP server (`mcp/`)

| File | What it is for |
|---|---|
| `mcp/server.js` | Runs the MCP server in two modes: **stdio** (Claude Desktop starts it as a local program) or **HTTP + SSE** with `--http` (hosted). In HTTP mode it checks the `X-Codepulse-Key` header against the stored hashes, but only when `NODE_ENV=production`; locally the check is skipped. |
| `mcp/tools.js` | One line: re-exports the tools from `api/services/tools.js`. **This is how the MCP server reuses the API's code.** 🎤 Nice point to make. |
| `mcp/manifest.json`, `mcp/package.json` | Package metadata; lists the 7 tool names. |

### Database (`api/prisma/`)

| File | What it is for |
|---|---|
| `api/prisma/schema.prisma` | **Every table defined in one file**: 16 models (tables) and 3 enums (fixed lists of allowed values). Part 5 goes through each one. |
| `api/prisma/migrations/*/migration.sql` | 11 migrations, April to September 2026. They tell the project's story: the first 5 tables, then the AI, findings, API-key and cluster phases, then the September reliability work (`AnalysisRun`, `CategoryResult`). |
| `api/prisma/migrations/migration_lock.toml` | Records that the migrations are for PostgreSQL. |

### Config and infrastructure

| File | What it is for |
|---|---|
| `docker-compose.yml` | Starts local **Redis 7** (port 6379) and **Postgres 16 with pgvector** (port **5433** on your machine). |
| `.env.example` | Names of the environment variables, with no values. 💡 Missing a few the code reads: `GITHUB_PUBLIC_PAT`, `GITHUB_APP_SLUG`, `DEMO_REPO_SEED_ID`, the Stripe keys, `DIGEST_TO_EMAIL`, `MCP_PORT`, `OPENAI_*_MODEL`. |
| `api/.env`, `worker/.env`, `dashboard/.env.local` | 🔒 Real secrets (database URLs, API keys, Clerk keys). **Gitignored. Not opened.** |
| `GITHUB_PRIVATE_KEY_PATH.pem` | 🔒 The GitHub App's private key, used to sign requests for App tokens. **Gitignored. Not opened.** 🎤 Don't open it while screen-sharing. |
| `KEYS` | An empty file that is tracked in Git even though `.gitignore` lists it. Harmless; could be deleted. |
| `.gitignore` | Ignores `node_modules`, env files, `*.pem`, `CLAUDE.md`, `HANDOFF.md`, `graphify-out/`. |
| `.claude/settings.json`, `CLAUDE.md`, `HANDOFF.md`, `graphify-out/` | AI-assistant notes and a generated knowledge graph. Not part of the running app. 💡 `CLAUDE.md` describes the *plan*, so parts of it are out of date (see 1.8). |
| `dashboard/next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs` | Standard Next.js / TypeScript / lint / Tailwind config. |

### Tests (`worker/test/`), Vitest

| File | What it is for |
|---|---|
| `worker/vitest.config.js` | Points tests at a **separate** test database (`codepulse_test`) and Redis DB number 15, and runs test files one at a time. |
| `worker/test/testEnv.js`, `globalSetup.js`, `setup.js` | Safety guards: refuse to run unless the database is local and ends in `_test`. Then apply the real migrations. |
| `worker/test/unit/healthScore.test.js` | Tests the score formula. |
| `worker/test/coordination/handoff.test.js` | Tests the "all five done → aggregate exactly once" logic, duplicates, crashes, and the sweeper. Uses real Postgres and a fake in-memory queue. |
| `worker/test/integration/pipeline.test.js` | Same pipeline against real Postgres **and** real Redis/BullMQ. |
| `worker/test/fakeQueue.js`, `helpers.js` | Test helpers: a fake BullMQ queue, sample reports, database reset. |
| 💡 Not covered | API routes, the dashboard, and the five analysis algorithms themselves. There's no end-to-end test and no CI pipeline yet. The tests focus deliberately on the hardest part: coordinating the workers. |

### Other files in the root

| File | What it is for |
|---|---|
| `README.md` | The project's showcase page. 💡 Some claims describe the original plan rather than the current code (see 1.8). |
| `CHANGES_EXPLAINED.md` | Your own write-up of the September reliability changes (AnalysisRun, handoff, sweeper). Useful background for Parts 3 and 8. |
| `CODE_TOUR.md` | An earlier, unfinished study guide (not committed). This guide replaces it. |
| `Claude outputs/showcase_multipage.pdf` | A generated PDF showcase. Not code. |

## 1.4 "Where do I look for...?"

| I want to find... | Look here |
|---|---|
| Where the API starts and routes are attached | `api/index.js:60-80` |
| Where HTTP requests come in from the browser | `api/routes/*.js`, called from `dashboard/lib/api.ts` |
| Where GitHub push events come in | `api/routes/webhook.js:8` |
| Where the webhook signature is checked | `api/middleware/verifyGithub.js:3-22` |
| Where a pasted URL is handled | `api/routes/analyze.js:11` |
| Where an App install is handled | `api/routes/install.js:9` |
| **Where analysis jobs are created** | `api/services/queue.js:22-46` (`createRunAndEnqueue`) |
| Where workers are started | `worker/index.js:22-31` |
| Where each analysis happens | `worker/workers/{complexity,vuln,deadcode,coverage,drift}.js` |
| **Where a check's result is saved** | `worker/lib/runLifecycle.js:58-82` (`recordCategoryOutcome`), into the `CategoryResult` table |
| **Where "are all five done?" is decided** | `worker/lib/runLifecycle.js:91-103` (`advanceToAggregating`) |
| **Where the score is calculated** | `worker/lib/healthScore.js:20-24`, called at `worker/workers/aggregator.js:37` |
| Where the Snapshot (final result) is saved | `worker/workers/aggregator.js:57`, using `upsertRunSnapshot` at `runLifecycle.js:152` |
| Where per-file results are saved | Each check upserts into `FileAnalysis` (e.g. `complexity.js:48`, `drift.js:46-56`) |
| Where findings are created | `worker/workers/aggregator.js:113-188` (`emitFindings`) |
| Where PR comments / Check Runs are posted | `api/services/prComment.js`, called from `aggregator.js:78-82` |
| **Where live updates are sent** | Workers `redis.publish(...)`, e.g. `aggregator.js:84`. The API forwards them at `api/index.js:87-98`. The browser listens in `dashboard/components/WorkerProgress.tsx:38-60`. |
| Where stuck runs are rescued | `worker/lib/sweeper.js:27-92` |
| Where login is checked (API) | `api/middleware/requireClerk.js:3-17` |
| Where login is required (browser pages) | `dashboard/proxy.ts:3-9` |
| Where "is this your repo?" is checked | Inside each route, e.g. `prisma.repo.findFirst({ where: { id, userId: req.userId } })` in `chat.js:11`. 💡 A few routes skip it (Part 7). |
| Where GitHub is called | `api/services/octokit.js` (App), `api/services/publicOctokit.js` (public), `api/services/prComment.js`, `api/services/tools.js:90-111` |
| Where OpenAI is called | `api/services/embed.js`, `api/services/openAI.js`, `worker/workers/cluster.js:13` |
| Where the AI tools are defined | `api/services/tools.js:115-209` |
| Where the database tables are defined | `api/prisma/schema.prisma` |
| Where raw SQL / pgvector is used | `drift.js:26-56`, `tools.js:17-25`, `files.js:17-34`, `cluster.js:30-71`, `aggregator.js:61-65`, `runLifecycle.js:92-98` |
| Where API keys are created and checked | Created: `api/routes/apiKeys.js:17-37`. Checked: `mcp/server.js:41-52` |
| Where emails are sent | `worker/digest/sendDigest.js` |
| Where the tests are | `worker/test/` (run with `cd worker && npm test`) |

## 1.5 The whole system in one diagram

```
                     ┌───────────────────────────────────────────────┐
   User's browser ──►│ DASHBOARD  (Next.js)            dashboard/    │
                     │  pages → lib/api.ts  (HTTP + Clerk JWT)        │
                     │  WorkerProgress.tsx  (Socket.IO client)        │
                     └──────┬──────────────────────────────▲──────────┘
             HTTPS /api/... │ Bearer token                 │ WebSocket events:
                            │                              │ 'worker-event', 'health-update'
                            ▼                              │
 GitHub ─ push webhook ──► ┌───────────────────────────────┴───────────────────┐
 GitHub ─ install redirect►│ API  (Express 5)             api/index.js          │
                           │  requireClerk → routes → Prisma                    │
                           │  services/queue.js fanOut:                         │
                           │    1) INSERT AnalysisRun   2) add 5 BullMQ jobs    │
                           │  Socket.IO server ◄── Redis SUBSCRIBE              │
                           └───────┬─────────────────────────────┬──────────────┘
                     BullMQ jobs   │                             │ SQL via Prisma
                                   ▼                             ▼
             ┌─────────── REDIS ─────────────┐       ┌──── POSTGRES + pgvector ────┐
             │ complexity / deadcode / vuln / │       │ User, Repo, AnalysisRun,    │
             │ coverage / drift queues        │       │ CategoryResult, Snapshot,   │
             │ aggregator / insights / cluster│       │ FileAnalysis (+embedding),  │
             │ pub/sub channels:              │       │ Finding, Insight, Cluster,  │
             │  codepulse:worker-event        │       │ ChatSession, ApiKey, ...    │
             │  codepulse:health-update       │       └──────────────▲──────────────┘
             └──────┬─────────────────▲───────┘                      │
          take jobs │                 │ PUBLISH progress             │ read/write
                    ▼                 │                              │
             ┌──────────── WORKER process ────────────────────────────┴───┐
             │ 5 checks, each wrapped by withRunTracking                  │──► GitHub API (read files)
             │   → save CategoryResult → "all 5 done?" handoff            │──► npm registry (npm audit)
             │ aggregator → score, Snapshot, Findings, PR comment         │──► OpenAI (embeddings, GPT)
             │ insights, cluster, sweeper (every 60s), digest cron        │──► Resend (email)
             └────────────────────────────────────────────────────────────┘

 AI assistant (e.g. Claude Desktop) ── stdio or HTTP+SSE ──► MCP SERVER  mcp/server.js
                                                              └─► api/services/tools.js ──► Postgres, GitHub, OpenAI
```

**The key idea in one sentence:** the API never does the heavy work. It writes a row saying "a run exists", drops five jobs into Redis, and answers the user straight away. The worker does the slow work, writes results to Postgres, and shouts progress through Redis, which the API passes to the browser.

**Why API and worker are separate processes:** analysis is slow (it calls GitHub hundreds of times, runs `npm audit`, and calls OpenAI). If the API did this itself, web requests would hang, and a crash in analysis would take the website down. With a queue in between, either side can restart without losing work. 🎤 This is the #1 design decision to explain well.

## 1.6 The tech stack, and why each piece is here

| Tool | Where | Why it is used here (one sentence) |
|---|---|---|
| **Node.js (ESM)** | api, worker, mcp | One language (JavaScript) across the whole backend, and a good fit for code that mostly waits on network calls (GitHub, OpenAI, database). |
| **Express 5** | api | A small, well-known HTTP framework for defining routes and middleware. |
| **Next.js 16 + React 19** | dashboard | Page routing by folder (`app/repos/[id]/page.tsx`) and easy deployment to Vercel. |
| **TypeScript** | dashboard | Catches type mistakes in the frontend at build time. (The backend is plain JavaScript.) |
| **Tailwind CSS 4** | dashboard | Styling with utility classes, without writing separate CSS files. |
| **TanStack Query** | dashboard | Fetches and caches API data, and refetches when told to (e.g. after a live score update). |
| **Zod** | dashboard | Checks at runtime that API responses have the expected shape. |
| **Clerk** | dashboard + api | Hosted login, so the app never stores passwords. The API only verifies Clerk's signed tokens. |
| **PostgreSQL (Neon when deployed)** | everywhere | The permanent source of truth. Relational data (users → repos → snapshots) fits tables well. |
| **pgvector** | Postgres | Stores file embeddings *in the same database* and finds similar files with one SQL query, so no separate vector database is needed. |
| **Prisma 6** | api, worker, mcp | Type-safe queries and managed migrations, with raw SQL only where Prisma can't help (vectors, one atomic update). |
| **Redis** | api + worker | Fast storage for the job queues and a pub/sub channel for live events. |
| **BullMQ** | api + worker | Reliable queues with retries, exponential backoff, job states, and duplicate-safe job IDs. |
| **ioredis** | api + worker | The Redis client BullMQ uses. Also used directly for publish/subscribe. |
| **Socket.IO** | api + dashboard | Pushes live progress to the browser without the browser constantly asking. |
| **Octokit (`@octokit/app`, `@octokit/rest`)** | api (+ worker via api) | Official GitHub client. `@octokit/app` handles the App's private key → short-lived installation token flow. |
| **OpenAI API** | api + worker | `text-embedding-3-small` for embeddings (drift, search, clusters). `gpt-4o` for chat/agents. `gpt-4o-mini` for cheap one-shot JSON (insights, cluster labels, tour). |
| **`npm audit`** (a command, not a library) | worker | Uses npm's own vulnerability database, so the app doesn't maintain a CVE list. |
| **ml-kmeans** | worker | Groups file embeddings into 4 clusters for the map. |
| **D3 + Recharts** | dashboard | Custom charts (heatmap, scatter, force graph) and standard charts (trend line). |
| **cmdk** | dashboard | The ⌘K command palette UI. |
| **react-hook-form** | dashboard | Form state and validation on the settings page. |
| **Stripe** | api + dashboard | To learn how subscription checkout and payment webhooks work. |
| **Resend** | worker | Sends the digest emails. |
| **node-cron** | worker | Runs the digest on a schedule (daily / Monday 9am). |
| **MCP SDK** | mcp | The official library for the Model Context Protocol. |
| **Vitest** | worker | Fast test runner that supports ESM out of the box. |
| **Docker Compose** | local dev | Starts Redis and Postgres+pgvector with one command. |
| **Render / Vercel / Neon** | deployment targets | Free-tier hosting options chosen for the API + worker, the dashboard, and serverless Postgres. |

🎤 If asked "why so many tools for a student project?", a good answer: *"Each one was a deliberate learning goal: queues, vector search, real-time updates, OAuth-style integrations. I used managed services (Clerk, Neon, Stripe) where building it myself wouldn't teach me much."*

## 1.7 Reading order: the fastest path to understanding

Read in this order. Each step builds on the one before. Rough time in brackets.

1. **`api/prisma/schema.prisma`** (15 min). Learn the nouns first: User, Repo, AnalysisRun, CategoryResult, Snapshot, FileAnalysis. Everything else moves these around.
2. **`api/index.js`** (5 min). See every route, the auth gate, and the Redis → Socket.IO bridge.
3. **`api/routes/analyze.js`** (5 min). The simplest entry point, start to end.
4. **`api/services/queue.js`** (5 min). "Insert the run first, then enqueue." Remember the `jobId: run.id` trick.
5. **`worker/index.js`** (3 min). Which function handles which queue.
6. **`worker/lib/runLifecycle.js`** (20 min, **the most important file**). `withRunTracking` → `recordCategoryOutcome` → `advanceToAggregating`.
7. **One simple check: `worker/workers/coverage.js`** (5 min), then **`complexity.js`** (5 min). See what a "report" looks like.
8. **`worker/workers/aggregator.js`** (15 min) + **`worker/lib/healthScore.js`** (5 min). How five reports become one score and one Snapshot.
9. **`worker/lib/sweeper.js`** (10 min). How stuck runs are rescued.
10. **`api/routes/webhook.js`** + **`api/middleware/verifyGithub.js`** + **`api/routes/install.js`** (10 min). The other two entry points.
11. **`dashboard/lib/api.ts`** → **`dashboard/app/repos/[id]/page.tsx`** → **`dashboard/components/WorkerProgress.tsx`** (15 min). How the browser sees it all.
12. **`api/services/tools.js`** → **`api/services/openAI.js`** → **`api/routes/chat.js`** → **`mcp/server.js`** (20 min). The AI layer and how MCP reuses it.
13. **`worker/test/coordination/handoff.test.js`** (15 min). The tests explain the tricky cases in plain test names.
14. Everything else (drift, deadcode, vuln, cluster, findings, settings, stripe) as needed.

## 1.8 Plan vs. reality: things the README or CLAUDE.md describe differently

The README and CLAUDE.md were written as a **plan** for the full product. Some parts got simpler or weren't finished. This is normal in a personal project, but the interviewer may read the README, so know these before they do.

| # | README / CLAUDE.md says | What the code actually does | Evidence | 🎤 Demo tip / how to say it |
|---|---|---|---|---|
| 1 | Complexity uses `escomplex` | A regex counts keywords like `if`, `for`, `&&`, `?`. `escomplex` is installed but not imported. | `complexity.js:4-17` | "I started with escomplex, then used a lighter regex version to support TypeScript without a parser." |
| 2 | Dead code uses `ts-prune` | Regex matching of `export` / `import { }` names. | `deadcode.js:11-48` | Same: a simpler approximation. |
| 3 | `GET /health` returns `{ ok: true }` | There's no `/health` on the API. `GET /` returns `{ status: 'ok' }`. (The MCP server has `/health`.) | `api/index.js:61`, confirmed with a test script | Only matters for hosting keep-alive pings. |
| 4 | README badge at `/badge/:owner/:name.svg` | Mounted under `/api/public` *after* the login check, so it answers **401**. | `api/index.js:64,77`, confirmed with a test script | Don't demo the badge. |
| 5 | Stripe webhook upgrades your plan | The webhook also sits behind the login check (401). Checkout opens, but the plan never changes. | `api/index.js:64,79`, confirmed with a test script | Demo the checkout page only, if at all. |
| 6 | ⌘K global search | The search route is switched off, and the client URL has a doubled `/api`. | `api/index.js:78`, `dashboard/lib/api.ts:186` | **Don't press ⌘K while sharing your screen.** |
| 7 | PR-comment toggle | The route file exists but isn't mounted. The aggregator still reads the setting. | `api/index.js:26`, `aggregator.js:75-78` | Explain it from the code instead. |
| 8 | Drift threshold is configurable | The settings page saves it, but the worker always uses `0.72`. | `drift.js:9`, `settings.js:58` | "The setting is stored; connecting it to the worker is a one-line change I haven't made yet." |
| 9 | Per-function complexity | The `FunctionMetric` table exists but nothing writes to it, so "top complex functions" on the file page is empty. | no `functionMetric.create` anywhere | Show the file page for the AI explanation, not the function list. |
| 10 | Coverage from "CI artifacts" | Reads `coverage/lcov.info` **committed in the repo**. | `coverage.js:7-12` | "Coverage only counts if the repo commits an lcov file; otherwise there's no penalty." |
| 11 | "14 database models" | 16 models + 3 enums. | `schema.prisma` | Small detail. |
| 12 | CLAUDE.md: `e2e/`, `.github/workflows/`, `services/openai.js`, `routes/agents/`, Prisma 7 in worker | Not built / named differently: `openAI.js`, `Agents/`, Prisma 6. | file listing | "CLAUDE.md is my planning doc; those were later phases." |
| 13 | Install callback at `/api/install/callback` | It's `/install/callback`. | `api/index.js:63` | Know the real URL if asked how the App is configured. |
| 14 | Public repo page `/[owner]/[name]` | Needs login and hits the same blocked API route. | `dashboard/proxy.ts:3`, `dashboard/lib/api.ts:170` | Don't demo it. |

**How to sum it up in the interview:** *"The core pipeline (runs, the handoff between workers, the sweeper, the score) is the part I focused on, and it's tested. Around the edges there are features I scaffolded but didn't fully wire up. I can show you exactly which ones, and what finishing each would take."*

**Safe demo path:**
1. Log in.
2. Go to Dashboard and paste a full `https://github.com/owner/repo` URL of a small JS/TS repo.
3. Watch the live pipeline on the repo page.
4. Look at the score and trend, insights, chat, and root-cause.
5. Look at the findings.
6. Show the MCP docs page, or Claude Desktop if it's set up.

## Part 1: Check your understanding

1. A user pastes a URL and gets a response in about a second, but the score shows up 30 seconds later. Explain, using the names of two processes and one piece of infrastructure, why those are two different moments.
2. The README says complexity is measured with `escomplex`. Is that true? What does the code really do, and in which file?
3. You want to change the health score formula. Which file do you open, and which test file should you run afterwards?

### Your answers and feedback

**Q1. You said:** "User got API response and results take a while because it is in queue."
**Verdict: half right.** The idea is correct, but the question asked for names, and in an interview the names are what show you really know it.
**Model answer:** "The **API** process (`api/routes/analyze.js`) only does the quick part. It inserts an `AnalysisRun` row, adds five jobs to **Redis** through BullMQ (`api/services/queue.js:22-46`), and replies with `{ repoId, commitSha, runId }`. The slow part happens later in a different process, the **worker** (`worker/index.js`). It picks up the five jobs, fetches files from GitHub, runs `npm audit`, and calls OpenAI. When all five checks are done, the aggregator computes the score and publishes it to Redis. The API forwards it to the browser over Socket.IO."
**Why it matters:** "It's in a queue" is what anyone would guess. "The API writes the run first, enqueues five jobs, and returns; a separate worker process does the work" shows you know the design.

**Q2. You said:** "True, `worker/workers/complexity.js`."
**Verdict: file right, answer wrong.** This one matters because it's a README claim an interviewer can check in 10 seconds.
**Model answer:** "No. `escomplex` is listed in `worker/package.json`, but nothing imports it. `complexity.js:4-17` uses a **regex heuristic**. It strips comments and strings, then counts `if`, `for`, `while`, `case`, `catch`, `?`, `&&`, `||` and `??`, and adds 1. It's per file, not per function, and it doesn't really parse the code."
**How to say it:** "The README mentions escomplex; the code actually uses a regex approximation. It's cheap and works on TypeScript without a parser, but it's less accurate. A real parser is what I'd add next."

**Q3. You said:** "`worker/workers/aggregator.js`."
**Verdict: close, but not the right file, and the test half is missing.**
- The aggregator only **calls** the formula: `computeHealthScore(results)` at `aggregator.js:37`.
- The formula itself is in **`worker/lib/healthScore.js`**. The weights are on line 3, the penalties on lines 5-18, and the final sum on lines 20-24. It was pulled out as a *pure function* (no database, no network) exactly so it can be tested alone.
- The test to run is **`worker/test/unit/healthScore.test.js`**, with `cd worker && npm test`.
- 💡 **Catch:** even this "unit" test needs local Postgres running (`docker compose up -d`). `vitest.config.js` runs `globalSetup.js` (which applies migrations) and `setup.js` (which queries the database) before *every* test file.
- You *would* also edit `aggregator.js` in one case: adding a new metric that has to be saved on the Snapshot (`aggregator.js:45-54`).

**Score: about 1.5 out of 3.** The two things to fix: always **name the processes and files**, and trust the code over the README.

---

# Part 2: The Three Ways an Analysis Starts

All three paths end at the **same function**: `createRunAndEnqueue` in `api/services/queue.js:22-46`. Understand that function once, and the three paths are just three different ways of answering:

1. **Who** is this user?
2. **Which repo** is it, and is it saved in the database?
3. **Which commit**, and **which files**?
4. **How will the worker get the files?** (`source` + `installationId`)

🎤 This "three doors, one hallway" framing is a clean way to explain it in an interview.

## 2.0 The shared ending: `createRunAndEnqueue`

```js
// api/services/queue.js:22-46
async function createRunAndEnqueue(payload) {
  const run = await prisma.analysisRun.create({                       // 1. write the run to Postgres FIRST
    data: { repoId: payload.repoId, commitSha: payload.commitSha },   //    status defaults to QUEUED
  });
  try {
    await Promise.all(
      Object.values(queues).map(q =>                                  // 2. one job in EACH of the 5 queues
        q.add('analyze', { ...payload, runId: run.id }, { ...defaultJobOptions, jobId: run.id })
      )
    );
  } catch (err) {
    await prisma.analysisRun.update({                                 // 3. Redis failed → mark the run FAILED
      where: { id: run.id },                                          //    instead of leaving it QUEUED forever
      data: { status: 'FAILED', error: `enqueue failed: ${err.message}`, finishedAt: new Date() },
    });
    throw err;
  }
  return run.id;
}
```

Four ideas to remember:

- **Database first, then queue.** If it enqueued first and then crashed before the insert, workers would do work for a run no one could ever look up. The reverse case (row written, crash before enqueue) is caught later by the sweeper (Part 3).
- **`jobId: run.id`.** BullMQ **ignores** an `add()` whose job ID already exists in that queue. So enqueueing the same run twice cannot create duplicate jobs. Everyday comparison: a coat-check ticket number. Handing in the same ticket twice doesn't give you two coats.
- **Retries:** `attempts: 5, backoff: exponential 2000ms` (`queue.js:14-17`). If a job throws, BullMQ retries it after about 2s, 4s, 8s, then 16s.
- **The payload** is what every worker receives in `job.data`: `{ repoId, owner, repoName, source, installationId, commitSha, ref, changedFiles, runId }`.

`fanOut` (App paths) passes the payload through unchanged. `fanOutPublic` (URL path) forces `source: 'public_url', installationId: null` (`queue.js:54-58`).

💡 **`changedFiles` means different things per path.** In the URL path it's "the first 200 files in the repo". In the webhook path it's "files added or modified in this push". In the install path it's **empty**. A clearer name would be `filesToAnalyze`.

---

## 2a. A user pastes a GitHub URL

🎤 This is the path to use in a live demo. It needs no GitHub App setup.

**Step by step, file by file:**

| # | Where | What happens |
|---|---|---|
| 1 | `dashboard/components/AnalyzeUrlForm.tsx:15-26` | On submit: `getToken()` gets the Clerk login token, then `analyzeRepo(url, token)` is called. When it returns, the page jumps to `/repos/<repoId>`. |
| 2 | `dashboard/lib/api.ts:30-35` | `axios.post(API_URL + '/analyze', { repoUrl }, { headers: { Authorization: 'Bearer <token>' } })` |
| 3 | `api/index.js:37-50` | A custom middleware reads the whole request body, keeps the raw text in `req.rawBody`, and parses the JSON into `req.body`. |
| 4 | `api/index.js:65` → `api/middleware/requireClerk.js:10-11` | Clerk verifies the token's signature. `req.userId = payload.sub` (the Clerk user ID, like `user_2abc...`). No valid token → **401**. |
| 5 | `api/routes/analyze.js:17-19` | A regex pulls `owner` and `repoName` out of the URL. No match → **400 "Invalid GitHub URL"**. |
| 6 | `analyze.js:21` → `publicOctokit.js:41-46` | **2 GitHub calls:** `repos.get` (to find the default branch), then `repos.getBranch` (to get the latest commit SHA on it). |
| 7 | `analyze.js:24-28` | **Upsert the User.** If this Clerk user has no row yet, create one with a placeholder email `<userId>@unknown.com`. |
| 8 | `analyze.js:31-32` | **GitHub call 3:** the whole file tree at that SHA, then `.slice(0, 200)`. Only the first 200 paths are kept. |
| 9 | `analyze.js:35` | **GitHub call 4:** `repos.get` **again**, just to get the numeric GitHub repo ID. (Step 6 already had this; small cleanup opportunity.) |
| 10 | `analyze.js:38-50` | **Upsert the Repo** by `(userId, githubRepoId)`. New: create with `source: 'public_url'`. Existing: only update `lastAnalyzedAt`. |
| 11 | `analyze.js:53-60` | `fanOutPublic({ repoId, owner, repoName, commitSha: sha, ref: sha, changedFiles })` |
| 12 | `analyze.js:63` | Reply `{ repoId, commitSha, runId }`. The whole thing takes about a second. The analysis hasn't really started yet. |

**How the user is identified:** by the Clerk token → `req.userId`. This is the only path of the three with a *verified* login.

**What is saved:** a `User` row (maybe new), a `Repo` row (new or `lastAnalyzedAt` updated), and an `AnalysisRun` row with status `QUEUED`.

**What jobs are created:** 5 jobs, one each in `complexity-queue`, `deadcode-queue`, `vuln-queue`, `coverage-queue` and `drift-queue`, all with `jobId = runId`, `source: 'public_url'`, `installationId: null`, and `ref` = the exact commit SHA.

**Good design points to mention:**
- `ref: sha` pins the **exact commit**. Every file the workers fetch comes from that one snapshot of the code, even if someone pushes in the meantime.
- Upserting on `(userId, githubRepoId)` means two different users can analyze the same public repo and each gets their own copy, with no duplicates for the same user.

**Limitations to know:**
- 💡 🎤 **Type the full URL in the demo.** The input's placeholder says `owner/repo` (`AnalyzeUrlForm.tsx:39`), but the regex needs `github.com/...`. Typing just `owner/repo` gives a 400, and the form has no `catch`, so the spinner just stops without an error message. **Always paste `https://github.com/owner/repo`.**
- 💡 **200-file cap, in tree order.** The first 200 paths may be mostly images or config files, so large repos are only partly analyzed. Fine for small demo repos.
- 💡 **GitHub rate limit.** Without `GITHUB_PUBLIC_PAT`, GitHub allows only 60 anonymous calls per hour. This route uses 4, and the dead-code worker can fetch up to 300 files. 🎤 **Set `GITHUB_PUBLIC_PAT` in `api/.env` before the interview**, or one demo run could use up the hour.
- 💡 Plan limits (`User.repoLimit`) are stored but not checked. There's no billing in practice, so that's fine for now.
- 💡 A private repo URL gives a plain 500 instead of a friendly message.
- 💡 Re-analyzing by URL a repo that already has the App installed still uses the public client (`fanOutPublic` forces `source: 'public_url'`). It works; it just doesn't use the App's higher rate limit.

---

## 2b. GitHub sends a webhook on push

A **webhook** is GitHub calling us. When someone pushes to a repo where the App is installed, GitHub sends `POST /webhook` with a JSON description of the push.

🎤 To demo this live, you need the API reachable from the internet (e.g. `ngrok http 3000`) and the App's webhook URL pointed at it. Otherwise, explain it from the code.

### Step 1: proving the request is really from GitHub

When the App was created, you and GitHub agreed on a **shared secret** (`GITHUB_WEBHOOK_SECRET`). For each delivery, GitHub computes `HMAC-SHA256(secret, body)` and sends it in the header `X-Hub-Signature-256: sha256=<hex>`. Only someone who knows the secret can produce the right value for that exact body.

Everyday comparison: a wax seal. Anyone can write a letter saying "From GitHub", but only GitHub has the seal. Change one comma in the letter and the seal no longer matches.

```js
// api/middleware/verifyGithub.js:3-22
export function verifyGithubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return res.status(401).json({ error: 'No signature' });

  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');   // recompute it ourselves

  const sigBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);
  if (sigBuffer.length !== digestBuffer.length) {                       // timingSafeEqual throws on unequal lengths
    return res.status(401).json({ error: 'Invalid signature' });
  }
  if (!crypto.timingSafeEqual(sigBuffer, digestBuffer)) {               // constant-time compare
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
}
```

**Three details interviewers ask about** 🎤:

1. **Why `req.rawBody` and not `req.body`?** The signature is over the *exact bytes* GitHub sent. If you parse the JSON and turn it back into a string, spacing and key order can change, and the signature won't match. That is why `api/index.js:37-50` keeps the raw text before parsing.
2. **Why `timingSafeEqual` and not `===`?** `===` stops at the first different character, so a wrong guess that starts correctly takes slightly longer to reject. By timing thousands of attempts, an attacker could in theory guess the signature one character at a time. `timingSafeEqual` always takes the same time. Comparison: a lock that tells you how many pins you got right by how long it takes to reject your key.
3. **Why the length check first?** `timingSafeEqual` throws an error if the two buffers are different lengths, so we reject early instead.

💡 **Things a real product would add** (good "what would you improve?" answers):
- **Replay protection:** GitHub sends a unique `X-GitHub-Delivery` ID with every delivery. Storing and checking it would stop a copied request from being sent again. Right now a resent copy just starts another analysis run.
- **Collect the body as bytes:** `data += chunk` (`index.js:40`) builds a string. Collecting `Buffer`s and joining them is the fully correct way, because a multi-byte character split across chunks can't be decoded wrongly.

### Step 2: the route itself (`api/routes/webhook.js`)

| # | Lines | What happens |
|---|---|---|
| 1 | `:9-12` | Only `push` events are handled. Anything else → `200 { skipped: true }`. |
| 2 | `:17-19` | If `after` is all zeros, the branch was **deleted**. Skip it. |
| 3 | `:22-24` | `changedFiles` = every file **added or modified** across all commits in the push, de-duplicated with a `Set`. Removed files are ignored. |
| 4 | `:26-27` | Read `installation.id` and `installation.account.login` (the GitHub username or org that installed the App). |
| 5 | `:30-53` | **Work out which CodePulse user owns this** (see below). |
| 6 | `:56-67` | **Upsert the Repo** on `(userId, githubRepoId)`. Existing: refresh `installationId` and set `source: 'github_app'`. New: create it. |
| 7 | `:70-79` | `fanOut({ repoId, owner, repoName, installationId, source: 'github_app', commitSha, ref, changedFiles })` |
| 8 | `:82` | Reply `200 { received: true, files: N }`. |

**How the user is identified.** There's no login token here; GitHub is the caller. So it's a three-step lookup:

```js
// api/routes/webhook.js:30-45
let resolvedUser = accountLogin
  ? await prisma.user.findFirst({ where: { githubLogin: accountLogin } })   // 1. match GitHub login
  : null;
if (!resolvedUser) {                                                       // 2. whoever already owns this repo
  const existingRepo = await prisma.repo.findFirst({
    where: { githubRepoId: repository.id, NOT: { userId: 'system' } }, ...
  });
  ...
}
const userId = resolvedUser?.id ?? 'system';                               // 3. give up → 'system' user
```

1. **By GitHub login.** `User.githubLogin` was saved during the App install (2c). If it matches the account that installed the App, that's our user.
2. **By existing repo.** Otherwise, find any non-system user who already has this repo.
3. **Fallback: `'system'`.** A made-up user (`plan: 'pro'`, `repoLimit: 9999`) is created if needed and owns the repo. The analysis still runs and is saved, but no real user sees it in the dashboard.

**What is saved:** maybe the `system` User, the `Repo` (new or updated), and an `AnalysisRun` (`QUEUED`).

**What jobs are created:** 5 jobs with `source: 'github_app'`, the `installationId`, `ref` like `refs/heads/main`, and only the pushed files as `changedFiles`.

**Limitations to know:**
- 💡 **Only changed files are analyzed.** A push that only edits `README.md` has zero JS/TS files, so average complexity and drift become 0 and **the score goes up**. The score after a push describes "the files in this push", not the whole repo. 🎤 A thoughtful interviewer may spot this in the trend chart. More in Part 4.
- 💡 **Branch name, not exact commit.** `ref` is `refs/heads/main`, so if a second push lands mid-analysis, the worker could read slightly newer code. Passing `commitSha` as the `ref` (like the URL path does) would fix it.
- 💡 **Every branch is analyzed**, not just the default branch, so feature-branch pushes show up in the same history.
- 💡 Only `push` events are handled. Repos added to the App later appear after their first push.
- 💡 No `try/catch` in the route: a database error gives GitHub a 500, and GitHub doesn't retry automatically, so that one push is skipped.

---

## 2c. A user installs the GitHub App

### How a GitHub App gets access (the background you need)

A GitHub App has a **private key** (the `.pem` file). To act on a user's repos:

1. CodePulse signs a short **JWT** with the private key, which proves "I am App #123".
2. It trades that JWT plus the **installation ID** with GitHub for an **installation access token**. The token works only on the repos that user chose, and **expires after 1 hour**.

`@octokit/app` does both steps inside `githubApp.getInstallationOctokit(installationId)` (`api/services/octokit.js:21-25`). This is why CLAUDE.md says never to cache the Octokit object: its token goes stale.

Everyday comparison: the `.pem` is the company master key kept in the safe. Each job gets a one-hour visitor badge that only opens the rooms that customer agreed to.

🎤 "How does a GitHub App authenticate?" is a very likely question. The two-step answer above is what they want.

### Step by step

| # | Where | What happens |
|---|---|---|
| 1 | `dashboard/components/InstallGithubApp.tsx:10` | The button links to `https://github.com/apps/<slug>/installations/new?state=<Clerk user id>`. |
| 2 | GitHub | The user picks which repos to allow and clicks Install. GitHub redirects the browser to the App's "Setup URL": `GET /install/callback?installation_id=12345&setup_action=install&state=<user id>`. |
| 3 | `api/index.js:63` | `/install` is mounted **without** `requireClerk`, because a browser redirect from GitHub can't carry our Bearer token. |
| 4 | `install.js:10` | `const { installation_id, state: userId } = req.query`. **The user is identified by `state`.** |
| 5 | `install.js:16-17` | Get an installation-scoped Octokit, then list the repos this installation can access (`per_page: 100`). |
| 6 | `install.js:19` | `githubLogin` = the owner of the **first** repo in that list. |
| 7 | `install.js:22-28` | **Upsert the User:** save `githubLogin` (this is what makes webhook step 1 work later), with a placeholder email `<userId>@clerk.placeholder` for a new user. |
| 8 | `install.js:33-45` | For **each** repo: upsert on `(userId, githubRepoId)`, and set `installationId` + `source: 'github_app'`. **This is the "upgrade" path:** if the user had analyzed this repo by URL before, the same row (same `repoId`, same history) becomes an App repo. No duplicate. 🎤 Nice detail to mention. |
| 9 | `install.js:49-66` | For each repo: get the latest commit on the default branch, then `fanOut({ ..., source: 'github_app', commitSha, ref: 'refs/heads/<default>', changedFiles: [] })`. A failure here is logged and skipped, so one bad repo doesn't stop the others. |
| 10 | `install.js:72` | Redirect the browser to `FRONTEND_URL/dashboard`. |

**How the user is identified:** from `state`, which is the Clerk user ID the dashboard put in the install link.

**What is saved:** User (with `githubLogin`), one `Repo` per accessible repo, and one `AnalysisRun` per repo.

**What jobs are created:** 5 jobs **per repo**. Installing on 10 repos creates 10 runs and 50 jobs.

**Limitations to know:**

- 💡 **The first analysis after install is mostly empty.** `changedFiles: []` (`install.js:65`) means complexity, dead code and drift get zero files; only vuln and coverage do real work. So the first score is higher than it should be. *Fix: list the repo's files (like the URL path does) instead of passing an empty list.* 🎤 If you demo the App, the first score will look suspiciously good. Now you know why.
- 💡 **`state` is trusted as-is.** It's just the user ID, and the callback doesn't check that the person is logged in or owns that installation. For a personal project with one user that's harmless. In a multi-user product, someone could in theory link another person's installation to their own account. *What I'd do: make `state` a random one-time value stored on the server and tied to the logged-in user, and check the installation belongs to them.* 🎤 This is a strong answer to "what security issues would you fix before launch?"
- 💡 Only the first 100 repos are listed (no pagination). If you install from GitHub's own page instead of the button, there's no `state` and the callback returns a 500.
- 💡 The redirect waits until every repo has been set up, one by one, so a large install takes a while to redirect.
- 💡 Placeholder emails (`@clerk.placeholder`, `@unknown.com`) are stored because the real email is never fetched from Clerk. Digest emails need recipients set in repo settings.

---

## 2d. (Bonus) The demo button is *not* an analysis

`POST /api/demo/fork` (`api/routes/demo.js`) copies the seed repo (`DEMO_REPO_SEED_ID`) to the user as `source: 'demo'` and copies **only its latest Snapshot row**. It creates **no `AnalysisRun` and no jobs**. So the demo has one data point, no per-file data (so no drift or cluster data), and no insight.

💡 It picks the "latest" snapshot without sorting (`demo.js:40`), and clicking twice copies the snapshot twice. 🎤 For the interview, a real URL analysis is a better demo than this button.

---

## 2e. The three paths side by side

| | **(a) Paste URL** | **(b) Push webhook** | **(c) Install App** |
|---|---|---|---|
| Entry file | `api/routes/analyze.js` | `api/routes/webhook.js` | `api/routes/install.js` |
| URL | `POST /api/analyze` | `POST /webhook` | `GET /install/callback` |
| Caller | Dashboard (browser) | GitHub's servers | Browser, redirected by GitHub |
| Proof of identity | Clerk JWT (`requireClerk`) | HMAC signature proves it's *GitHub*; the *user* is looked up | `state` query parameter (the user ID) |
| How the user is found | `req.userId` from the token | `githubLogin` → existing repo owner → `'system'` | `state` = Clerk user ID |
| Commit | Default-branch HEAD SHA | `after` from the push | Default-branch HEAD SHA |
| `ref` sent to workers | exact SHA | branch name | branch name |
| `changedFiles` | first 200 paths in the repo | added + modified in the push | empty |
| `source` / how files are fetched | `public_url` / anonymous or PAT | `github_app` / installation token | `github_app` / installation token |
| Rows written | User, Repo, AnalysisRun | (system User), Repo, AnalysisRun | User, Repo ×N, AnalysisRun ×N |
| Jobs | 5 | 5 | 5 per repo |
| Queue function | `fanOutPublic` | `fanOut` | `fanOut` |

🎤 **One sentence for the interview:** *"There are three doors: a logged-in user pasting a URL, GitHub's signed push webhook, and the App-install redirect. Each one works out the user, repo, commit and file list differently, but they all call the same `createRunAndEnqueue`, which writes an `AnalysisRun` row first and then puts five jobs in the queues, using the run's ID as the job ID so a duplicate enqueue is ignored."*

## Part 2: Check your understanding

1. The webhook route has no login token. What does it use to prove the request came from GitHub? And what does it use to decide which CodePulse user owns the repo?
2. Why does `verifyGithub.js` use `req.rawBody` instead of `req.body` to compute the HMAC?
3. A user installs the App on a big, complex repo and gets a surprisingly high score on the first analysis. Using a specific line of code, explain why.

### Your answers and feedback

**Q1. You said:** "SHA 256 and installation ID and GitHub User Id."
**Verdict: half right, in both halves.**
- **Proving it's GitHub:** "SHA-256" alone isn't enough. Anyone can compute a plain SHA-256 of a body. What makes it proof is that it's an **HMAC**: SHA-256 *mixed with a shared secret* (`GITHUB_WEBHOOK_SECRET`) that only GitHub and CodePulse know. GitHub sends it in the `X-Hub-Signature-256` header. We recompute it and compare with `timingSafeEqual` (`verifyGithub.js:7-17`).
- **Finding the user:** not the installation ID, and not a numeric GitHub user ID.
  - It uses the **GitHub login name** (`installation.account.login`, e.g. `harshilmodh`), matched against `User.githubLogin`. That field was saved during the App install (`webhook.js:30-32`).
  - If there's no match, it uses **whoever already owns this repo**.
  - If that fails too, it uses the made-up **`'system'` user** (`webhook.js:35-45`).
  - The installation ID is saved on the **Repo**, and it's used later to *fetch files*, not to identify the user.

**Model answer:** "An HMAC-SHA256 signature using a shared secret proves the request came from GitHub. For ownership it's a three-step lookup: match the installer's GitHub login to `User.githubLogin`, else the existing repo owner, else a `'system'` user."

**Q2. You said:** "`req.body` can parse it into JSON."
**Verdict: right direction, but the reason is missing.** Yes, `req.body` is the *parsed* JSON. The important part is **why that breaks the check**:
- The signature is calculated over the **exact bytes** GitHub sent.
- Turning the parsed object back into text (`JSON.stringify`) can change spacing, key order or escaping.
- One changed byte gives a completely different HMAC, so every real webhook would fail.
- That's why `api/index.js:37-50` saves the original text as `req.rawBody` *before* parsing.

**Model answer:** "The HMAC covers the exact raw bytes. Parsing and re-serializing can change those bytes, so we keep the untouched body for verification."

**Q3. You said:** "It limits at 200."
**Verdict: wrong path.** The 200-file cap is in the **paste-URL** path (`analyze.js:32`, `allPaths.slice(0, 200)`), not the install path.
- The install path passes an **empty list**: `changedFiles: []` at **`install.js:65`**.
- Complexity, dead code and drift only look at `changedFiles`, so they each analyze **zero files**. Their penalties become 0.
- Only vuln (`npm audit`) and coverage do real work.
- Result: the first score is too high.

**Model answer:** "`install.js:65` sends `changedFiles: []`, so three of the five checks analyze nothing and give no penalty. The fix is to list the repo's files, the way the URL path does."

**Score: about 1 out of 3.** Two habits to build:
1. **Say the mechanism, not just the name.** Not "SHA-256", but "an HMAC with a shared secret".
2. **Keep the three paths separate in your head.** The 200 cap belongs to the URL path; the empty list belongs to the install path. The comparison table in 2e is worth memorising.

---

# Part 3: One Analysis, Start to Finish

We follow **one run** of a pasted URL through every file it touches. Keep this picture in mind. Each numbered box below is a section of this part.

```
 [3.1] API: INSERT AnalysisRun (QUEUED) + add 5 jobs  ─────────────────────────────┐
                                                                                    │ Redis (BullMQ)
 [3.2] Worker picks up each job ─► withRunTracking                                  ▼
          ├─ first one flips QUEUED → RUNNING                        complexity  deadcode  vuln  coverage  drift
          ├─ runs the check (complexity.js / vuln.js / ...)              │          │        │       │        │
 [3.3]    └─ recordCategoryOutcome: save CategoryResult row  ◄───────────┴──────────┴────────┴───────┴────────┘
 [3.4]        └─ advanceToAggregating: "are all 5 rows there?"   (only ONE caller gets "yes")
                     │ yes: RUNNING → AGGREGATING, add 1 aggregator job
                     ▼
 [3.5] aggregator.js: score → [3.6] Snapshot → [3.7] insights job → [3.8] cluster job
                     → [3.9] findings → [3.10] PR comment → [3.11] live updates → SUCCEEDED
 [3.12] sweeper.js: every 60s, rescues any run that got stuck anywhere above
```

## 3.0 Why the design looks like this (the story in 30 seconds)

🎤 Interviewers love "what was the problem, and how did you solve it?" This is your best story.

- **Before (the original code):** each check wrote its result into a temporary **Redis hash** (a key-value map with a 24-hour expiry). After each write, a worker read the hash. If it saw 5 results, it deleted the hash and queued the aggregator.
- **Problems:**
  - There was no permanent record that a run existed.
  - If one check failed all its retries, the run waited forever.
  - A crash between "delete the hash" and "queue the aggregator" lost the result completely.
- **After (the September commits `4c41490` → `b2571d0`):**
  - Every run is a **row in Postgres** (`AnalysisRun`) with a status.
  - Every check's result is a **row** (`CategoryResult`).
  - "Are all five done?" is **one conditional SQL UPDATE** that only one worker can win.
  - A **sweeper** rescues anything a crash left behind.

Your own notes on this are in `CHANGES_EXPLAINED.md`.

## 3.1 The `AnalysisRun` record and its states

One row = one analysis request. It's the run's permanent record.

```
          createRunAndEnqueue           first worker starts         last result saved
 (none) ────────────────────► QUEUED ─────────────────► RUNNING ─────────────────► AGGREGATING
                                │                          │                             │
                   Redis down   │           sweeper: jobs  │            aggregator done  │
                   or sweeper:  │           dead / 60-min  │           (all 5 OK)        ▼
                   no jobs      ▼           timeout ────► records FAILED rows ──►   SUCCEEDED
                              FAILED ◄──────────────────────────────── any category FAILED,
                                                                        or aggregator's last attempt fails,
                                                                        or its job died (sweeper)
```

| Status | Meaning | Who sets it | Where |
|---|---|---|---|
| `QUEUED` | Row created, 5 jobs added, no worker started yet | database default | `queue.js:23-25` |
| `RUNNING` | At least one check has started | the **first** check to start | `runLifecycle.js:32-35` |
| `AGGREGATING` | All 5 checks have a result row; aggregator job queued | the **one** worker that wins the handoff | `runLifecycle.js:91-103` |
| `SUCCEEDED` | Snapshot saved, everything done | aggregator, as its last step | `aggregator.js:102` → `runLifecycle.js:107-113` |
| `FAILED` | Gave up; `error` explains why | enqueue failure, aggregator, or sweeper | `queue.js:38-41`, `runLifecycle.js:115-121`, `sweeper.js` |
| `PARTIAL` | Planned: "finished, but something was skipped" | 💡 **nobody**. It's in the enum but never used. | `schema.prisma:57` |

The columns that matter: `status`, `error`, `startedAt`, `finishedAt`, `updatedAt` (the sweeper uses these timestamps), and `prCommentClaimedAt` (3.10).

**Why a Postgres enum and not a plain string?** The database itself rejects a typo like `'SUCEEDED'` (comment at `schema.prisma:50-51`).

## 3.2 The five jobs, and how workers pick them up

`worker/index.js:22-31` creates one BullMQ `Worker` per queue:

```js
new Worker('complexity-queue', withRunTracking('complexity', processComplexity), workerConfig),
...
new Worker('aggregator-queue', processAggregator, workerConfig),   // no wrapper: it's not a "category"
```

- `concurrency: 5` → each worker may process up to 5 jobs at the same time.
- The five checks are **not** run directly. Each is wrapped in **`withRunTracking(category, processor)`** (`runLifecycle.js:7-54`). That wrapper holds *all* the rules about runs, so the five checks stay simple: "take `job.data`, return a report".

What the wrapper does, in order:

```js
// runLifecycle.js:18-35 (shortened)
const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { status: true } });

if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) {        // (1) late or duplicate delivery?
  if (run?.status === 'AGGREGATING') await ensureAggregationEnqueued(runId);   // self-heal
  return { skipped: true };
}

await prisma.analysisRun.updateMany({                              // (2) first worker flips QUEUED → RUNNING
  where: { id: runId, status: 'QUEUED' },                          //     the others match 0 rows: harmless
  data: { status: 'RUNNING', startedAt: new Date() },
});
```

Then:

3. **Run the check** (`report = await processor(job)`).
4. **If it threw:** only on the **final attempt** (`isFinalAttempt`, `runLifecycle.js:125-127`) save a `FAILED` result. Always re-throw, so BullMQ retries it (up to 5 attempts) or marks the job failed.
5. **If it worked:** save the result (3.3).

💡 **Why `updateMany` and not `update`?** `update` finds a row by its unique ID and fails if nothing matches. `updateMany` accepts any condition (here: "id = X **and** status = QUEUED") and just reports how many rows changed. It's the Prisma way to write a **conditional update**. Four of the five workers change 0 rows, and that's fine.

## 3.3 How each result is saved: `recordCategoryOutcome`

```js
// runLifecycle.js:58-82 (shortened)
const run = await prisma.analysisRun.findUnique(...);
if (run?.status !== 'RUNNING') return false;                  // results "freeze" once aggregation starts

if (error === undefined) {
  await prisma.categoryResult.upsert({                        // SUCCESS: overwrite my own row
    where: { runId_category: { runId, category } },
    create: { runId, category, status: 'SUCCEEDED', report: json },
    update: { status: 'SUCCEEDED', report: json, error: null },
  });
} else {
  await prisma.categoryResult.createMany({                    // FAILURE: insert only if no row yet
    data: [{ runId, category, status: 'FAILED', error }],
    skipDuplicates: true,                                     // = INSERT ... ON CONFLICT DO NOTHING
  });
}
return advanceToAggregating(runId);                           // then try the handoff
```

Three rules to remember:

1. **One row per (run, category).** The unique rule `@@unique([runId, category])` (`schema.prisma:279`) makes it impossible to store two results for "complexity of run X".
2. **Success overwrites; failure never does.** If a duplicate delivery succeeds after an earlier recorded failure, success wins. If a failure arrives after a success, it's ignored. So "success wins".
3. **Save first, count second.** The result is **committed** (saved permanently) *before* the handoff counts rows. This ordering is the whole trick in 3.4.

**What's inside `report`?** Whatever the check returned, stored as JSON. For example complexity returns `{ avgComplexity, files: [...] }` and vuln returns `{ critical, high, moderate, low, total }`. Part 4 covers each.

**Separately,** each check also writes **per-file** rows into `FileAnalysis` while it runs (e.g. `complexity.js:48-52`). 💡 Those rows are keyed by `(repoId, filePath)`, so they hold the **latest** value for each file, not a value per run. `snapshotId` is always `null`.

## 3.4 How the system knows all five are done: the conditional update

This is the most important piece of code in the project. 🎤 Be able to draw it on a whiteboard.

```js
// worker/lib/runLifecycle.js:91-103
export async function advanceToAggregating(runId) {
  const advanced = await prisma.$executeRaw`
    UPDATE "AnalysisRun"
    SET status = 'AGGREGATING', "updatedAt" = ${new Date()}
    WHERE id = ${runId}
      AND status = 'RUNNING'
      AND (SELECT COUNT(*) FROM "CategoryResult" WHERE "runId" = ${runId}) = ${CATEGORIES.length}
  `;
  if (advanced === 1) await ensureAggregationEnqueued(runId);
  return advanced === 1;
}
```

**In plain English:** "Change this run to AGGREGATING, but **only if** it is still RUNNING **and** it has exactly 5 result rows." The database answers with how many rows it changed: **1** means you won, **0** means you didn't.

**The problem it solves: the race condition.** Five workers finish at roughly the same time. We need **exactly one** of them to queue the aggregator. Zero means the run is stuck forever; two means double work.

**Why nobody can be left out (the "everyone saw 4" problem).** Each worker **commits its own row first**, and only *then* runs this UPDATE. So whichever worker commits **last** is guaranteed to see all 5 rows when it counts. There's no moment where every worker sees only 4 of 5.

**Why two can't both win.** Say workers A and B both see 5 rows at the same instant.
1. Postgres **locks the row** for A's UPDATE.
2. B waits for the lock.
3. When A commits, Postgres **re-checks B's `WHERE`** against the updated row. B now sees `status = 'AGGREGATING'`, not `'RUNNING'`, so B updates **0 rows**.
4. Only A gets `1`, so only A queues the aggregator.

Everyday comparison: five people finish a group exam and race to hand in the cover sheet. The rule is "the cover sheet can only be stamped if all five answer papers are already in the box, and it hasn't been stamped yet." Everyone drops their own paper in *first*, then tries to stamp. The stamp can only happen once.

**Why raw SQL here?** Prisma can't express "update where the count in *another table* equals 5" as one atomic statement. Two separate Prisma calls (count, then update) would leave a gap for the race to happen in.

**Proof it works:** `worker/test/coordination/handoff.test.js:58-82` tries **all 120 possible finishing orders** of the five checks, and also fires all five at the same instant 25 times. It asserts exactly one handoff every time.

**Belt and braces:** `ensureAggregationEnqueued` (`queues.js:22-24`) adds the aggregator job with `jobId: runId`. Even if something called it twice, BullMQ would ignore the second add.

## 3.5 The aggregator

`worker/workers/aggregator.js:12-110`. Its job carries **only `{ runId }`**. Everything else is read from Postgres, which is what lets the sweeper re-queue it knowing nothing but the ID.

| Step | Lines | What happens |
|---|---|---|
| 1 | `:17-20` | Load the run. Missing → skip. Already `FAILED` → skip. |
| 2 | `:22-26` | Load all 5 `CategoryResult` rows. If any is missing, **throw** (that "should never happen", so retry). |
| 3 | `:30-34` | If any category is `FAILED`: mark the run **FAILED**, create **no snapshot**, stop. (No point retrying: the inputs won't change.) |
| 4 | `:35-37` | Pull out the 5 reports and call `computeHealthScore(results)` (formula in Part 4). |
| 5 | `:38-44` | Publish `worker: 'aggregator', phase: 'calculating'`. |
| 6 | `:45-57` | Build and **upsert the Snapshot** (3.6). |
| 7 | `:60` | Queue the **insights** job (3.7). |
| 8 | `:61-71` | If the repo has ≥ 20 embedded files, queue the **cluster** job (3.8). |
| 9 | `:73` | **Create findings** (3.9). |
| 10 | `:75-82` | If PR comments are enabled and we win the claim, **post the PR comment** (3.10). |
| 11 | `:84-101` | Publish **`health-update`** and `phase: 'done'` (3.11). |
| 12 | `:102` | **Mark the run SUCCEEDED.** This is deliberately the very last step. |
| on error | `:104-109` | Re-throw so BullMQ retries. Only the **final** attempt marks the run FAILED. |

💡 **Why "SUCCEEDED" is last:** if the worker crashes at step 9, the run is still `AGGREGATING`. The job retries, or the sweeper re-queues it, and the whole aggregator runs again. That's safe because every step is **safe to repeat** (the next sections show why).

💡 **Small leftovers:**
- Line 68 creates a **new** `Queue('cluster-queue')` object every time and never closes it. That's the exact connection leak `queues.js:7-8` says was fixed for the other queues.
- The run is marked FAILED if **any single** category failed, so one flaky `npm audit` means no score at all. The unused `PARTIAL` status was the planned alternative: "score with what we have".

## 3.6 The snapshot

A **Snapshot** is the permanent result of one successful run: `healthScore`, the five headline numbers, `commitSha`, `createdAt`, and `runId`. It's what the trend chart plots.

```js
// runLifecycle.js:152-158
export async function upsertRunSnapshot(runId, data) {
  return prisma.snapshot.upsert({
    where: { runId },                       // Snapshot.runId is @unique → one snapshot per run
    create: { ...data, runId },
    update: { commitSha: data.commitSha },  // looks pointless, but see below
  });
}
```

- **Why an upsert on `runId`?** If the aggregator runs twice for the same run, the second call gets the **same snapshot back** instead of making a duplicate. Every later step then uses the same `snapshot.id`.
- **Why the odd `update: { commitSha }`?** Prisma only produces a single atomic `INSERT ... ON CONFLICT DO UPDATE` statement when the update part isn't empty. With `update: {}` it would do "SELECT, then INSERT" as two steps, and two simultaneous aggregations could both see "no row" and both try to insert. The loser would crash with a unique-constraint error. (Comment at `runLifecycle.js:146-151`.) 🎤 A great "attention to detail" point if you can explain it.

💡 `coverage: coverage.coverage ?? -1` (`aggregator.js:52`): **-1 means "no coverage report found"**. The insights worker understands that (`insights.js:20`), but the live `health-update` message sends `?? 0` instead (`aggregator.js:92`). The same missing value shows up as -1 in one place and 0 in another.

## 3.7 Insights

- **Queued:** `aggregator.js:60` → `insightsQueue.add('insights', { snapshotId }, { jobId: snapshot.id })`. Using the snapshot ID as the job ID means a repeated aggregation doesn't queue it twice.
- **Worker:** `worker/workers/insights.js`. It reads the snapshot's numbers and asks `gpt-4o-mini` (through `chatJSON`, JSON mode) for `{ topRisks[], improvements[], nextAction }`. It saves the answer as one `Insight` row (`snapshotId` is unique: one insight per snapshot).
- **On error:** it saves a "fallback" insight with empty lists, so the page stops waiting.
- **Read by:** `GET /api/snapshots/:id/insights` (`api/routes/insights.js`). It returns `202 { pending: true }` until the row exists, and `InsightCards.tsx` keeps asking until it does.

💡 The AI only sees six summary numbers, not your code, so the insights are fairly generic. `tokensIn/tokensOut` are always saved as 0 ("fine for now", `insights.js:38`).

## 3.8 Clustering

- **Queued only if** the repo has **≥ 20 files with embeddings** (`aggregator.js:61-71`). Embeddings come from the drift check, so small repos never get a cluster map.
- **Worker:** `worker/workers/cluster.js`.
  1. Load every embedding for the repo with raw SQL (`embedding::text`, because Prisma can't read the vector type).
  2. Run **k-means with K = 4**: group the files into 4 clusters whose embeddings are close together.
  3. **Delete the repo's old clusters.**
  4. For each group, ask `gpt-4o-mini` for a short label + summary from 5 sample file paths.
  5. Save each `Cluster` and its **centroid** (the "average point" of the group) with raw SQL.
  6. Point each `FileAnalysis.clusterId` at its cluster.
- **Read by:** `GET /api/repos/:id/clusters` → `ClusterGraph.tsx` (D3 force graph).

💡 K is always 4, whatever the repo's shape. The "edges" between clusters in `clusters.js:30-47` are a made-up heuristic (files with drift scores within 0.1 of each other), not real imports or dependencies.

## 3.9 Findings

`emitFindings` (`aggregator.js:113-188`) turns report data into **Finding** rows, like a to-do list: "High complexity in src/x.js". Each is upserted on `(repoId, type, filePath)`, so a re-run **updates** the text but keeps the status you set (e.g. "dismissed").

It *tries* to create four kinds:

| Type | Built from | Created in practice? |
|---|---|---|
| `complexity` | `complexity.files` where complexity ≥ 10 (≥ 20 = high) | ✅ **Yes**: the only kind that works |
| `vuln` | `vuln.vulnerabilities` (critical/high) | 💡 **No**: `vuln.js` only returns counts, never a `vulnerabilities` list |
| `drift` | `drift.flaggedFiles` as a list | 💡 **No**: `drift.js:70` returns `flaggedFiles` as a *number* (a count), and a number has no `.length` |
| `dead_code` | `deadcode.deadFiles` | 💡 **No**: `deadcode.js` never returns `deadFiles` |

🎤 The findings page will only ever show "High complexity" items. If asked: *"The findings pipeline and triage UI work end to end, but only the complexity worker's report is in the shape the aggregator expects. Making the other three workers return file-level lists is the next step."* (The test helper even uses `flaggedFiles: []`, a list, in `helpers.js:11`, which is why tests didn't catch this.)

💡 Findings are never closed automatically: if you fix a complex file, its finding stays `open` until you change it.

## 3.10 PR comments

- **When:** only if the repo's settings have `{ type: 'pr_comments', enabled: true }` inside `alertRules` (`aggregator.js:75-76`). (The route that turns this on isn't mounted; see 1.8 #7.)
- **At most once:** `claimPrComment(runId)` (`runLifecycle.js:138-144`) moves `prCommentClaimedAt` from `NULL` to now with a conditional `updateMany`. Only one caller can win. The claim is written **before** posting.
  - *Trade-off, stated in the code:* if posting fails after the claim, the comment is never posted. **A missing comment is better than duplicate spam on a PR.** 🎤 A good example of choosing "at most once" on purpose.
- **What:** `api/services/prComment.js`.
  - It posts a GitHub **Check Run** (the ✓/✗ next to a commit): ≥ 60 success, 40–59 neutral, < 40 failure.
  - It also comments a Markdown score table on every **open** PR containing that commit.
  - Only for `github_app` repos, because it needs the installation token.

## 3.11 Live updates to the dashboard

```
 worker file ──redis.publish──► channel 'codepulse:worker-event'   ─┐
 aggregator  ──redis.publish──► channel 'codepulse:health-update'  ─┤  Redis pub/sub
                                                                    ▼
 api/index.js:87-98   subscriber.on('message') ──► io.emit('worker-event' | 'health-update', data)
                                                                    ▼
 dashboard/components/WorkerProgress.tsx:38-60   socket.on(...) → filter by repoId → update UI
                                                 health-update → onUpdate() → re-fetch snapshots
```

- **Events:** each check publishes `phase: 'start'` and `phase: 'done'` (e.g. `complexity.js:29-36`, `:71-78`). The aggregator publishes `calculating`, then `health-update`, then `done`.
- **Why go through Redis?** The worker and the API are separate processes. The worker can't reach the browser; only the API holds the Socket.IO connections. Redis pub/sub is the "intercom" between them.
- **In the browser:** `WorkerProgress` lights up each check. On `health-update` it calls `onUpdate`, and the repo page (`app/repos/[id]/page.tsx:38-40`) tells TanStack Query to **re-fetch the snapshots**, so the new score appears. 🎤 Good to demo live.

💡 **Limitations (more in Part 6):**
- `io.emit` sends every event to **every** connected browser, and each browser filters by `repoId` itself. Fine for one user. A real product would use Socket.IO **rooms**, one per repo or user.
- Pub/sub is "fire and forget": if the browser is disconnected when the message is sent, it's lost. The page still shows the right score on the next re-fetch or reload, because the real data is in Postgres.
- **A failed run sends no event,** so the pipeline boxes can sit on "running". There's also no API route to ask for a run's status (the `runId` returned by `/api/analyze` isn't used by the dashboard yet; see the comment at `analyze.js:62`).

## 3.12 The sweeper: rescuing stuck runs

The normal path handles every failure that **throws an error**. The sweeper handles the ones that don't: a process killed halfway, a job lost from Redis, a job that hangs forever.

`worker/lib/sweeper.js`. It runs **once at startup**, then **every 60 seconds** (`startSweeper`, `:97-103`). Three checks:

| # | Looks for | Limit | What it does | Lines |
|---|---|---|---|---|
| 1 | Runs stuck in **AGGREGATING** | 2 min | Aggregator job **missing** → re-queue it. Aggregator job **failed** (e.g. crashed on its last attempt) → mark run FAILED. Job waiting/active → leave it. | `:33-49` |
| 2 | Runs stuck in **RUNNING** | check after 2 min; give up at 60 min | For each category with no result: if its job is dead (`missing / failed / completed / unknown`) or 60 minutes have passed → record a **FAILED** result (success still wins if it arrives). Then try the handoff again, which also covers "all 5 saved, but crashed before the UPDATE". | `:52-75` |
| 3 | Runs stuck in **QUEUED** | 10 min | If **none** of the 5 jobs exist, the API died between the insert and the enqueue → mark run FAILED. If jobs are just waiting in a long queue → leave them. | `:79-89` |

**Why it's safe to run in several worker processes at once:** every action is conditional or idempotent. It uses the same `recordCategoryOutcome` / `advanceToAggregating` / `markRunFailed` functions as the normal path, `skipDuplicates` inserts, and job IDs = run IDs. Two sweepers doing the same thing at once just means one of them changes nothing. (`sweeper.js:95-96` explains why it uses a simple `setInterval` instead of a BullMQ repeating job.)

**Tested:** `handoff.test.js:223-294`, including "running the sweeper twice changes nothing the second time".

💡 It checks at most 50 runs per status per sweep (`BATCH`, `:15`). That's plenty for this project.

## 3.13 The whole run on one screen (memorise this)

1. **API** inserts `AnalysisRun` (**QUEUED**) → adds 5 jobs with `jobId = runId` → returns immediately.
2. **Worker** picks up each job; `withRunTracking` skips late duplicates; the first worker flips it to **RUNNING**.
3. Each check computes a **report** (writing per-file `FileAnalysis` rows along the way).
4. `recordCategoryOutcome` **commits** a `CategoryResult` row (success overwrites; failure only if no row yet).
5. `advanceToAggregating`: **one conditional UPDATE**. Only the worker that sees all 5 rows *and* still-RUNNING wins → **AGGREGATING** → queues the aggregator.
6. **Aggregator** reads the 5 rows → any FAILED → run **FAILED**. Otherwise it computes the score and **upserts the Snapshot** on `runId`.
7. It queues **insights** (and **cluster** if ≥ 20 embedded files), upserts **findings**, maybe posts a **PR comment** (claimed once), and publishes **health-update**.
8. Marks the run **SUCCEEDED**. The **sweeper** rescues any run stuck at any step.

## Part 3: Check your understanding

1. Five category workers finish at almost the same moment. Explain in your own words why **exactly one** of them queues the aggregator: why not zero, and why not two?
2. The aggregator's job carries only `{ runId }`. Why is that a deliberate choice? (Hint: think about who else might need to re-queue it.)
3. On the findings page you only ever see "High complexity in ..." items, never drift or vulnerability findings. Why?

*(Answers and feedback are added below after you reply.)*

---

> **Plan change (agreed):** to leave more time for interview practice, the rest of the guide is shorter and written in one go. Parts 5 + 8 are merged, and so are 6 + 7. Part 3's questions are still open above. Answer them any time.

# Part 4: The Five Checks, and the Score Formula

For each check: **what** it measures, **how** the code measures it, **what it calls outside the app**, and **what happens when it fails**. That last question is really: *can a failure make the score look better than it should?*

One idea underlies everything below. The score is `100 − penalties`. So **anything that makes a check report "nothing found" raises the score.** A check that silently analyzes zero files looks exactly like a perfect repo.

## 4.1 Complexity: `worker/workers/complexity.js`

**What it measures and why it matters.** *Cyclomatic complexity* = the number of different paths through a piece of code. Each `if`, loop, `case`, `&&` adds a path. More paths mean harder to read, harder to test, more places for bugs. Comparison: a road with 2 turns vs. a maze with 40 junctions.

**How the code measures it: a regex heuristic, not a parser.**

```js
// complexity.js:5-17
function calcComplexity(content) {
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')   // remove block comments
    .replace(/\/\/.*/g, '')              // remove line comments
    .replace(/`[^`]*`/g, '""')          // blank out template strings
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')   // and "strings"
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");  // and 'strings'
  const branches = /\bif\b|\belse\s+if\b|\bfor\b|\bwhile\b|\bdo\b|\bcase\b|\bcatch\b|\b\?\s*[^:]/g;
  const logicalOps = /&&|\|\||\?\?/g;
  return 1 + (stripped.match(branches) ?? []).length + (stripped.match(logicalOps) ?? []).length;
}
```

- Only `.js/.jsx/.ts/.tsx` files in `changedFiles` (`:28`).
- One number **per file** (the whole file's branch count), saved to `FileAnalysis.complexity` (`:48-52`).
- The report: `avgComplexity` = average over files, plus a `files` list (used for findings).

**Outside calls:** GitHub, one request per file (`fetchFile`).

**💡 Accuracy limits (know these):**
- **Per file, not per function.** The formula treats 10 as the maximum (see 4.6), a threshold meant for *one function*. A normal 200-line file easily scores 30+, so most real repos get the **full 25-point complexity penalty**. The per-function `FunctionMetric` table was meant to fix this but is never filled.
- A regex doesn't really understand code. Words in JSX text ("Please **do** this **if** you can") get counted. `??` is counted twice (it matches both patterns). Optional chaining `a?.b` counts as a branch.
- *How to say it:* "A cheap, language-agnostic approximation that ranks files well relative to each other, but it isn't a true cyclomatic score. An AST parser like escomplex or typhonjs per function is the upgrade."

**When it fails:** each file is in its own `try/catch` (`:55-57`). A file that errors (rate limit, network) is **skipped silently**, and the average is taken over the files that worked. **If every file fails, `avgComplexity = 0` → no penalty → the score goes up.** The job itself almost never fails.

## 4.2 Vulnerabilities: `worker/workers/vuln.js`

**What and why.** Known security holes (published as **CVEs**, "Common Vulnerabilities and Exposures") in the npm packages your project depends on. Most real-world JS security problems come from dependencies, not your own code.

**How.**
1. Fetch the repo's root `package-lock.json` (`:26`). This file lists the *exact* version of every installed package.
2. Write it into a temp folder with a fake `package.json` (`:33-37`).
3. Run the real command **`npm audit --json`** there (`:40-41`). npm compares the versions against its advisory database.
4. Read `metadata.vulnerabilities` → counts of `critical / high / moderate / low / total` (`:43-50`).
5. Delete the temp folder (`:54`).

Why `execFile` and not `exec`: `execFile` runs the program directly, without a shell, so nothing in the input can be interpreted as extra shell commands.

**Outside calls:** GitHub (1 file) + the **npm registry** over the internet (npm audit sends the dependency list to npm).

**💡 Limits:**
- Only a root `package-lock.json`. Repos using `yarn.lock` or `pnpm-lock.yaml`, or monorepos with lockfiles in sub-folders, show **0 vulnerabilities**.
- It returns counts only, no package names, so no vulnerability *findings* are ever created (Part 3.9).
- The temp folder name uses `repoId.slice(0, 8)` (`:33`). Two runs of the same repo at the same time share a folder, and one can delete it under the other. Rare.

**When it fails:**
- No lockfile → 0 vulns (logged "skipping").
- `npm audit` crashes, has no network, or prints bad JSON → caught at `:51-53` → **0 vulns → score goes up.**
- A non-404 GitHub error fetching the lockfile *does* throw → BullMQ retries → after 5 attempts the category is FAILED → the run is FAILED (no misleading score).

## 4.3 Dead code: `worker/workers/deadcode.js`

**What and why.** *Dead code* = exported functions or values that nothing imports. It's clutter: you still have to read and maintain it, and it hides what's really used.

**How: name matching with regex.**
1. List every file in the repo (`fetchRepoTree`) and keep up to **300** JS/TS files (`:57-60`).
2. Fetch all of them **in parallel** (`Promise.all`, `:62-67`).
3. Build one big set of **every name imported anywhere** with `import { a, b } from ...` (`parseImports`, `:32-48`).
4. For each *changed* JS/TS file, list its named exports (`export const x`, `export function y`, `export { a, b as c }`; `parseExports`, `:11-29`). Any export whose name is **not** in the imported set is "dead".
5. Save `FileAnalysis.isDead` per file (`:100-104`).

**Outside calls:** GitHub. 1 call for the tree **plus up to 300 file fetches per run**. This is the most expensive check.

**💡 Limits:**
- **Matching by name only, across the whole repo.** If *any* file imports something called `config`, *every* export named `config` counts as used.
- **Not understood:** `export default`, `import * as`, `require()` / CommonJS, and dynamic `import()`.
- **Framework entry points look dead.** Next.js `metadata` or `getServerSideProps`, and a library's public API, are never imported inside the repo.
- **The ratio is miscalculated.** `totalExports` adds `deadExports + 1` per file (`:112`) instead of counting real exports. One file with 3 exports, 1 dead, gives `1 / 2 = 50%` instead of 33%. 🎤 A genuine bug worth mentioning if asked.
- It never returns `deadFiles`, so no dead-code findings are created.
- Even when `changedFiles` is empty (the install path), it still fetches up to 300 files for nothing.

**When it fails:** because of `Promise.all`, **one** failed fetch (e.g. a GitHub rate limit, HTTP 403) rejects the whole step → the job throws → retries (2s, 4s, 8s, 16s). A rate limit usually lasts up to an hour, so all 5 attempts fail → category FAILED → **run FAILED, no snapshot**. This check fails loudly rather than silently.

## 4.4 Coverage: `worker/workers/coverage.js`

**What and why.** *Test coverage* = the percentage of code lines that run during your tests. Low coverage means changes can break things without any test noticing.

**How.**
- Look for an **lcov** report (a standard coverage file format) at four common paths: `coverage/lcov.info`, `lcov.info`, `coverage/lcov.dat`, `.nyc_output/lcov.info` (`:7-12`).
- Parse it by adding up `LF:` (lines found) and `LH:` (lines hit) → `coverage = hit / found` (`:15-23`).
- It also computes a `delta` versus the previous snapshot (`:57-67`), which nothing uses.

**Outside calls:** GitHub, up to 4 file requests.

**💡 Limits:**
- It only works if the repo **commits its coverage report**, which most repos don't (it's usually gitignored and produced in CI). So most repos show **coverage unknown**.
- **Unknown coverage gets no penalty,** the same as 100% (`healthScore.js:13-15`). The unit test deliberately pins this behaviour (`healthScore.test.js`, "missing coverage is NOT penalized").
- `delta` subtracts the previous snapshot's coverage, which may be the `-1` "unknown" marker, so the delta can be nonsense. Harmless, since it's unused.

**When it fails:** each path read is in `try/catch` (`:39-49`). Errors → `null` → no penalty → **looks better.** The job basically never fails.

## 4.5 Drift: `worker/workers/drift.js`

**What and why.** *Architectural drift* = a file that doesn't fit the rest of the codebase, for example a file that mixes database code into UI code, or a one-off style. The idea: **files that "belong" should resemble some of their neighbours.**

**How: embeddings + pgvector.** For each changed JS/TS file:
1. Fetch the content and **embed** it: OpenAI `text-embedding-3-small` turns the text (first 32,000 characters) into 1,536 numbers (`embed.js`).
2. Ask Postgres for the **5 most similar other files in the same repo** that already have embeddings:
   ```sql
   -- drift.js:26-34
   SELECT "filePath", 1 - (embedding <=> $vector::vector) AS similarity
   FROM "FileAnalysis"
   WHERE "repoId" = $repoId AND "filePath" != $filePath AND embedding IS NOT NULL
   ORDER BY similarity DESC LIMIT 5
   ```
3. `maxSimilarity` = the best match. If there are no other files yet → `1.0` (`:36-38`).
4. **Drifting if `maxSimilarity < 0.72`** (`:9`, `:40`). *Even its closest neighbour isn't very similar.*
5. Save `driftScore = maxSimilarity` and the embedding (raw SQL `UPDATE ... ::vector`, `:46-56`).
6. `driftRatio = flagged / total JS files` (`:64`).

**Outside calls:** GitHub (1 per file) + **OpenAI (1 embedding per file, costs money)** + Postgres vector queries.

**💡 Limits:**
- It really measures **"how much of an outlier is this file?"**, not "how much has this file changed over time". Say it that way in the interview.
- **Order matters.** The very first file ever analyzed has no neighbours → similarity 1.0 → never flagged. Files are compared against embeddings saved by *earlier* runs, which may be out of date.
- `0.72` is hard-coded. The drift threshold in settings is saved but never used (1.8 #8).
- There's no vector **index** (HNSW / IVFFlat). Each query compares against every embedding in the repo. Fine at this size.

**When it fails:** per-file `try/catch` (`:60-62`). If OpenAI fails (no key, rate limit, quota), every file is skipped → `flaggedFiles = 0` → **no penalty → looks better.**

## 4.6 The health score formula

`worker/lib/healthScore.js`: a **pure function**, no database or network, so it's easy to test.

```js
// healthScore.js:3
export const WEIGHTS = { complexity: 0.25, vuln: 0.25, deadcode: 0.15, coverage: 0.20, drift: 0.15 };  // sums to 1.0

// healthScore.js:5-18 : each penalty is on a 0–100 scale
complexity: Math.min((avgComplexity / 10) * 100, 100),         // avg 10+ = max penalty
vuln:       Math.min(critical*10 + high*5 + moderate*2, 100),  // low is ignored
deadcode:   deadCodeRatio * 100,
coverage:   coverage == null ? 0 : (1 - coverage) * 100,       // unknown = NO penalty
drift:      driftRatio * 100,

// healthScore.js:20-24
score = clamp(0, 100, 100 − Σ penalty × weight)
```

Because the weights sum to 1 and every penalty is capped at 100, the worst possible total is exactly 100, so the score can't go below 0. (The test "weights sum to 1, so the worst case is exactly 0" checks this.)

### Worked example with real numbers

Imagine the five reports for one run say:

| Check | Report | Penalty (0–100) | × weight | = points lost |
|---|---|---|---|---|
| Complexity | `avgComplexity: 6.4` | 6.4 / 10 × 100 = **64** | × 0.25 | **16.0** |
| Vulns | 0 critical, 2 high, 3 moderate | 0×10 + 2×5 + 3×2 = **16** | × 0.25 | **4.0** |
| Dead code | `deadCodeRatio: 0.30` | **30** | × 0.15 | **4.5** |
| Coverage | `coverage: null` (no lcov) | **0** | × 0.20 | **0.0** |
| Drift | `driftRatio: 0.10` | **10** | × 0.15 | **1.5** |
| | | | **Total lost** | **26.0** |

**Health score = 100 − 26 = 74.0**, which the dashboard labels "Healthy" (60–79).

**Now the same repo with a coverage report showing 45%:** coverage penalty = (1 − 0.45) × 100 = 55, × 0.20 = 11 points. Total lost = 37 → **score 63.0**.

🎤 **The punchline:** *the repo that publishes its coverage report scores 11 points lower than the one that hides it.* That's the clearest example of "missing data counts as perfect". A better design is to leave unknown categories out and re-balance the remaining weights, or show "unknown" instead of a number.

**Quick checks against the unit tests** (`healthScore.test.js`): avg complexity 5 → 87.5. One critical + one high + one moderate → 95.75. 10 criticals and 1,000 criticals both → 75 (the cap).

### Why these weights?

They're **judgment calls**, not research-based: complexity and security matter most (25% each), coverage next (20%), dead code and drift least (15% each, because they're the fuzziest measurements). 🎤 Honest answer if asked: *"They're my own weighting. In a real product I'd let teams tune them, and validate them against something like bug counts."*

## 4.7 Summary: can a failure make the score look better?

| Check | Failure mode | Effect on score |
|---|---|---|
| Complexity | Files fail to fetch → skipped | ⬆️ Better (fewer or zero files averaged) |
| Vulns | No lockfile / not npm / `npm audit` fails | ⬆️ Better (0 vulns) |
| Dead code | Any fetch fails → whole job throws | ⛔ Run FAILED, no score (fails *loudly*) |
| Coverage | No lcov (the usual case) | ⬆️ Better (no penalty) |
| Drift | OpenAI fails → files skipped | ⬆️ Better (0 flagged) |
| All three file-based checks | Push that touches no JS/TS files, or the App-install run (`changedFiles: []`) | ⬆️ Better: complexity, dead code and drift all become 0 |

**The one-sentence interview answer:** *"The coordination layer never loses or double-counts a result, but the individual checks treat 'couldn't measure' as 'nothing wrong'. The fix is to have each check report how many files it actually analyzed, and to mark the run `PARTIAL` (the status already exists in the schema) instead of silently scoring it."*

---

# Part 5 + 8: The Database, and What Happens When Things Go Wrong

## 5.1 Every table in one view

**Postgres enums** (fixed lists of allowed values): `AnalysisRunStatus` (QUEUED, RUNNING, AGGREGATING, SUCCEEDED, PARTIAL, FAILED), `AnalysisCategory` (the 5 checks), `CategoryStatus` (SUCCEEDED, FAILED).

| Table | One row means... | Key columns | Unique rules / indexes, and **why** |
|---|---|---|---|
| **User** | One person | `id` (= Clerk user ID, or `'system'`), `email`, `plan`, `repoLimit`, `githubLogin` | `email` unique. 💡 `clerkId`, `stripeCustomerId`, `stripeSubscriptionId`, `planActiveUntil` exist but are never written; emails are often placeholders. |
| **Repo** | One user's copy of one GitHub repo | `githubRepoId`, `owner`, `name`, `source` (`github_app` / `public_url` / `demo`), `installationId?`, `defaultBranch`, `lastAnalyzedAt` | **`@@unique([userId, githubRepoId])`**: the same repo may belong to many users, but only once per user. This is what makes the URL → App "upgrade" an update instead of a duplicate. |
| **AnalysisRun** | One analysis request | `status`, `commitSha`, `error`, `startedAt`, `finishedAt`, `updatedAt`, `prCommentClaimedAt` | `@@index([repoId, createdAt])` for "runs of this repo, newest first". `@@index([status, updatedAt])` for the sweeper's "stuck in status X since time Y" query. |
| **CategoryResult** | One check's outcome within one run | `runId`, `category`, `status`, `report` (JSON), `error` | **`@@unique([runId, category])`**: at most 5 rows per run; duplicate deliveries overwrite instead of adding. The handoff counts these rows. |
| **Snapshot** | The final result of one successful run | `healthScore`, `complexity`, `vulnCount`, `deadCode`, `coverage` (−1 = unknown), `driftScore`, `commitSha`, `runId?` | **`runId @unique`** → one snapshot per run (the aggregator upserts on it). Nullable because snapshots from before AnalysisRun existed have no run; Postgres allows many NULLs under a unique rule. `@@index([repoId, createdAt])` for the trend chart. |
| **FileAnalysis** | The **latest** known metrics for one file of one repo | `filePath`, `complexity`, `isDead`, `driftScore`, **`embedding vector(1536)`**, `clusterId?` | **`@@unique([repoId, filePath])`**: each check upserts the same row. 💡 `snapshotId` is always null, so there's no per-run file history. 💡 `@@index([repoId])` is redundant: the unique index already starts with `repoId`. |
| **Insight** | AI summary of one snapshot | `topRisks`, `improvements` (JSON), `nextAction`, `model` | `snapshotId @unique` → one insight per snapshot. |
| **Finding** | One issue to triage | `type`, `severity`, `filePath?`, `title`, `body`, `status` (open / acknowledged / resolved / dismissed / snoozed / wont_fix), `snoozedUntil`, `dismissReason` | **`@@unique([repoId, type, filePath])`**: re-runs update the same finding and keep its status. Indexes on `(repoId, status)` and `(repoId, type)` for filtering. 💡 Rows with a null `filePath` aren't de-duplicated (Postgres treats NULLs as all different); `line` and `assigneeId` are never used. |
| **FindingComment** | A comment on a finding | `findingId`, `userId`, `body` | Cascade-deleted with the finding. |
| **RepoSettings** | Settings for one repo | `driftThreshold`, `digestCadence`, `digestRecipients[]`, `alertRules` (JSON; holds the PR-comment toggle) | `repoId` **is** the primary key → exactly one settings row per repo (one-to-one). |
| **ApiKey** | One personal MCP key | `key` (**SHA-256 hash**), `prefix` (first 10 chars, for display), `lastUsedAt` | `key @unique` → lookup by hash. Index on `userId`. |
| **Cluster** | One group of similar files | `label`, `summary`, `fileCount`, **`centroid vector(1536)?`**, `snapshotId` | Index on `(repoId, snapshotId)`. Centroid is nullable because Prisma can't `create()` a row with a *required* `Unsupported` column, so it's filled by raw SQL right after. |
| **ChatSession** / **ChatMessage** | One conversation / one message in it | `repoId`, `userId`, `mode` / `role`, `content` | Index on `(repoId, userId)`. 💡 ChatSession has no foreign key to Repo or User (plain strings). `toolCalls`, `citations`, `tokens*`, `persona` are never written. |
| **FunctionMetric** | Complexity of one function | `name`, `startLine`, `endLine`, `cyclomatic` | 💡 Never written anywhere. |
| **DigestLog** | One digest email sent | `repoId`, `summary` (JSON) | 💡 No relation or foreign key: just a log. |

**Relationships in one line:** `User 1─* Repo 1─* AnalysisRun 1─* CategoryResult`, and `AnalysisRun 1─1 Snapshot 1─1 Insight`. A Repo also has many `FileAnalysis`, `Finding`, `Cluster`, and one `RepoSettings`. Deleting a Repo **cascades** (deletes its runs, snapshots, files, findings, clusters and settings too). Deleting a run leaves its snapshot but sets `runId` to null (`onDelete: SetNull`), so history survives.

## 5.2 Where raw SQL is used instead of Prisma, and why

Prisma is used for almost everything. Raw SQL appears in exactly two situations:

1. **Vectors.** Prisma doesn't support the `vector` column type (it's declared as `Unsupported("vector(1536)")`), so reading, writing and comparing embeddings needs SQL:
   - write: `drift.js:52-56`, `cluster.js:67-71`
   - similarity search: `drift.js:26-34`, `tools.js:17-25` (AI `search_code`), `files.js:17-34` (similar files), `rag.js` (unused)
   - read as text: `cluster.js:30-34` (`embedding::text`)
   - count: `aggregator.js:61-65`
   - Queries use Prisma's **tagged template** (`` $queryRaw`...${value}` ``), which sends values as parameters, not pasted text, so they're safe from SQL injection. (`handoff` tests use `$executeRawUnsafe` only for a fixed `TRUNCATE`.)
2. **The atomic handoff.** "Update the run only if the count in *another table* is 5" must be one statement (`runLifecycle.js:92-98`). Part 3.4 explains why.

## 5.3 What the migrations changed over time

| Date | Migration | What changed |
|---|---|---|
| Apr 10 | `init` | First 5 tables: User, Repo, Snapshot, FileAnalysis (with `vector`), DigestLog. Enabled the `vector` extension. `Repo.githubRepoId` was globally unique; `installationId` was required. |
| Apr 17 | `add_file_analysis_unique` | `(repoId, filePath)` unique, so workers can **upsert** file rows. |
| Apr 24 | `phase1_onboarding` | Public-URL support: `installationId` becomes optional; add `source`, `defaultBranch`, `isPublicDemo`, `lastAnalyzedAt`; `githubLogin`. The global `githubRepoId` unique is **dropped** and replaced by `(userId, githubRepoId)`. |
| May 1 | `phase2_ai` | Insight, ChatSession, ChatMessage. |
| May 9 | `phase3_detail` | FunctionMetric, RepoSettings, Finding, FindingComment. |
| May 9 | `add_api_keys` | ApiKey (hashed). |
| May 9 | `finding_dedup_unique` | `(repoId, type, filePath)` unique on Finding. |
| May 22 | `phase5_clusters` | Cluster table + `FileAnalysis.clusterId`, `Repo.lastClusteredCommit`, Stripe columns on User. |
| Jun 9 | `cluster_centroid_nullable` | Centroid made optional (the Prisma `Unsupported` limitation). |
| Sep 23 | `add_analysis_run` | **AnalysisRun** + status enum + the two indexes. |
| Sep 23 | `category_results_and_snapshot_run` | **CategoryResult**, `Snapshot.runId` (unique), `prCommentClaimedAt`. The reliability redesign. |

🎤 The migration list tells the project's story: *core pipeline → public onboarding → AI → triage → clusters → a reliability rewrite at the end.*

## 8. Reliability: what happens when things go wrong

| Situation | What happens | Where it's handled |
|---|---|---|
| **A job runs twice** (retry, redelivery, or double enqueue) | Enqueue twice → ignored (`jobId = runId`). A category delivered twice → the second either **overwrites its own row** (success) or does nothing (failure), or is **skipped** entirely if the run is past RUNNING. Aggregation twice → **same snapshot** (upsert on `runId`), same insights job (`jobId = snapshot.id`), findings upserted, PR comment claimed once. | `queue.js:33`, `runLifecycle.js:18-28, 66-80, 138-158`, `aggregator.js:60`. Tested in `handoff.test.js:118-221` and `pipeline.test.js:67-100`. |
| **A worker crashes halfway** (process killed) | BullMQ holds a **lock** on each active job (30s, renewed while alive). If the process dies, the lock expires and BullMQ's stalled-job check puts the job back in the queue. The next delivery re-runs the check, which is safe (row above). If it stalls a second time (`maxStalledCount: 1`), BullMQ marks it failed **without** our catch block running, so the **sweeper** sees a `failed` job with no result and records FAILED. If it crashes *after* saving but before the handoff, the sweeper runs the handoff. If it crashes after the handoff but before queueing the aggregator, the sweeper re-queues it. | BullMQ defaults; `sweeper.js:33-75`. Tested in `handoff.test.js:223-294`. |
| **Redis goes down** | API: `q.add` throws inside `createRunAndEnqueue` → the run is marked **FAILED** ("enqueue failed") and the route returns 500. Workers: BullMQ and ioredis keep trying to reconnect, and processing resumes when Redis returns. Jobs already in Redis survive **only if Redis persists to disk**. 💡 Live events published during the outage are lost (pub/sub has no memory), but the data is in Postgres, so a page reload shows it. | `queue.js:36-43`. 💡 No explicit health check or alert. |
| **The database is briefly unavailable** | In a worker: Prisma throws → the job fails → BullMQ **retries with backoff** (2, 4, 8, 16s), which rides out short blips. If it fails while saving a finished result, the whole check re-runs on retry (wasteful but correct). In the API: the route returns 500 and the user retries. In the sweeper: the tick logs an error and tries again in 60s. | `queue.js:14-17` (retry options), `sweeper.js:98-100`. |
| **GitHub rate-limits us** | 💡 Nothing waits for the rate-limit reset. Complexity, drift and coverage **skip** failed files (the score looks better). Dead code's `Promise.all` makes the job fail; retries (~30s total) finish long before a rate-limit window ends, so the **run is FAILED**. Vuln fails similarly if the lockfile fetch is limited. *Mitigation:* set `GITHUB_PUBLIC_PAT` (60 → 5,000 requests/hour). *Real fix:* Octokit's throttling plugin, or a BullMQ rate limiter. | Per-file `try/catch` in the checks; `deadcode.js:62-67`. |
| **One category fails every retry** | The last attempt saves a `FAILED` CategoryResult (`isFinalAttempt`), which still counts toward "5 rows", so the handoff happens. The aggregator sees a FAILED category → run **FAILED**, no snapshot. It is **never stuck**. 💡 One flaky check means no score at all (the `PARTIAL` idea would help). | `runLifecycle.js:40-48`, `aggregator.js:30-34`. Tested in `handoff.test.js:101-116` and `pipeline.test.js:112`. |
| **Two workers finish at the exact same moment** | Both commit their rows, both run the conditional UPDATE, Postgres's row lock makes the second one re-check `status = 'RUNNING'` and change 0 rows. **Exactly one** queues the aggregator. | `runLifecycle.js:91-103` (Part 3.4). Tested: all 120 orders + 25 simultaneous bursts, `handoff.test.js:58-82`. |
| **The same commit is analyzed twice** (Analyze clicked twice, or GitHub redelivers a webhook) | 💡 **Not de-duplicated.** Each request creates a **new run**, so there are two runs and **two snapshots with the same `commitSha`** (uniqueness is on `runId`, not the commit). `FileAnalysis` and findings are upserts, so they just get overwritten. The only cost is a duplicate point on the trend chart and double API usage. *Fix:* reuse a recent in-flight or succeeded run for the same `(repoId, commitSha)`, or check `X-GitHub-Delivery`. | Nothing handles it. |

🎤 **The reliability summary:** *"I aimed for **at-least-once** job execution with **idempotent** steps. Anything can run twice safely, and a sweeper guarantees nothing waits forever. The exception is the PR comment, which is deliberately **at-most-once** so it can never spam a pull request."*

---

# Part 6 + 7: Dashboard, Live Updates, MCP Server, Login and Security

## 6.1 Live updates, and what happens if a message is missed

The full path is in Part 3.11. In short: **worker `redis.publish` → Redis channel → API `subscriber.on('message')` → `io.emit` → browser `socket.on` in `WorkerProgress.tsx`.**

**If a message is missed** (browser closed, Wi-Fi dropped, API restarting):
- Redis pub/sub **does not store messages**. A message with no listener is simply gone. Comparison: a radio broadcast, not a voicemail.
- **No data is lost,** because the real results are in Postgres. The live channel is only a "refresh now" signal.
- The page recovers when the snapshots query runs again: on reload, or when TanStack Query refetches as you switch back to the tab (its default `refetchOnWindowFocus`).
- 💡 The pipeline boxes don't recover. If you miss the `done` events, they can stay "running". There's no "give me the current run status" endpoint to catch up.
- *If it were real:* use Socket.IO **rooms** (so each browser only gets its own repos' events and a login check on connect), and add `GET /api/runs/:id` so the UI can re-sync after reconnecting.

## 6.2 Dashboard pages and the API calls they make

| Page (URL) | File | API calls |
|---|---|---|
| `/` landing | `app/page.tsx` | `POST /api/analyze` (hero form) |
| `/dashboard` | `app/dashboard/page.tsx` | `GET /api/repos`. Buttons: `POST /api/analyze`, `POST /api/demo/fork`, GitHub install link |
| `/repos/:id` (main) | `app/repos/[id]/page.tsx` | `GET /api/repos/:id/snapshots` + Socket.IO. Panels: `GET /api/snapshots/:sid/insights` (InsightCards), `POST .../chat` (ChatPanel, SSE), `POST .../agents/root-cause` (SSE), `POST .../agents/tour` |
| `/repos/:id/chat` | `chat/page.tsx` | `GET .../chat/sessions`, `GET .../chat/sessions/:sid`, `POST .../chat` |
| `/repos/:id/debate` | `debate/page.tsx` | `POST .../agents/debate` (SSE) |
| `/repos/:id/findings` and `/findings` | `findings/page.tsx` | `GET /api/findings?...`. FindingCard: `PATCH /api/findings/:id`, `POST /api/findings/:id/comments` |
| `/repos/:id/files/<path>` | `files/[...path]/page.tsx` | `GET .../files/neighbors?path=`, `POST .../files/explain` (SSE) |
| `/repos/:id/settings` | `settings/page.tsx` | `GET` / `PATCH .../settings` |
| `/repos/:id/map` | `map/page.tsx` | `GET .../clusters` |
| `/settings/api-keys` | `settings/api-keys/page.tsx` | `GET` / `POST` / `DELETE /api/settings/api-keys` |
| `/pricing` | `pricing/page.tsx` | `POST /api/stripe/checkout` |
| `/docs/mcp` | `docs/mcp/page.tsx` | none (instructions) |
| ⌘K palette, search bar | `CommandPalette.tsx`, `GlobalSearchBar.tsx` | `GET /api/search` 💡 not mounted (don't demo) |
| `/:owner/:name` | `[owner]/[name]/page.tsx` | `GET /api/public/:owner/:name` 💡 blocked (don't demo) |

**How the AI streams work:** chat, root-cause, debate and explain-file use **SSE**. The route sets `Content-Type: text/event-stream` and writes lines like `data: {"type":"token","content":"Hel"}` as they arrive (`chat.js:29-34`). The page reads the stream piece by piece with `fetch` + a reader. Events are `token`, `tool_call`, `tool_result`, `done` and `error`, so the UI can show "🔧 calling read_file..." live.

**How the tool-calling loop works:** `chatStream` in `api/services/openAI.js:21-115`:
1. Send the messages + tool list to OpenAI (streaming).
2. If the model replies with text only → done.
3. If it asks for tools → run each with `executeTool` (15-second timeout each), add the results to the conversation, and loop.

Safety limits: at most **10 tool calls** and a **60-second total budget**. 🎤 Good answer to "how do you stop an agent looping forever?"

## 6.3 The MCP server

**What it is.** MCP (Model Context Protocol) is a standard that lets an AI assistant, like Claude Desktop or an IDE agent, call tools in your app. CodePulse's MCP server lets you ask Claude *"what's the health of my repo, and which files are most complex?"* and Claude calls CodePulse's tools to answer.

**Tools offered (7):** `find_repo`, `search_code` (pgvector semantic search), `get_metrics`, `get_snapshot_history`, `get_findings`, `read_file`, `get_diff`.

**How it reuses the API's code.** This is the neat part:

```js
// mcp/tools.js : the whole file
export { mcpTools, executeTool } from '../api/services/tools.js';
```

`api/services/tools.js` defines each tool **once** (name, description, JSON-schema parameters, `execute` function). It then exports the same list in two shapes:
- `openAITools` (OpenAI function-calling format) for the in-app chat,
- `mcpTools` (`inputSchema` format) for MCP.

One implementation, two AI front ends. 🎤 Nice "don't repeat yourself" example.

**Two ways to run it** (`mcp/server.js`):
- **stdio** (default): Claude Desktop starts `node mcp/server.js` as a local program and talks over standard input and output. Nothing is exposed to the network.
- **HTTP + SSE** (`--http`, port 3002): for hosting. Clients open `GET /sse` and send messages to `POST /messages?sessionId=...`. It checks an `X-Codepulse-Key` header against the **hashed** API keys, but **only when `NODE_ENV=production`**.

## 7.1 How login works (Clerk)

1. The user signs in on the dashboard through **Clerk** (a hosted login service). `dashboard/proxy.ts` sends anyone not logged in to sign-in, except for `/`, `/pricing`, and the sign-in pages.
2. In the browser, `getToken()` returns a short-lived **JWT** signed by Clerk.
3. Every API call sends `Authorization: Bearer <JWT>` (`dashboard/lib/api.ts`).
4. `requireClerk` (`api/middleware/requireClerk.js:10-11`) verifies the signature with `verifyToken(token, { secretKey })`. If valid, `req.userId = payload.sub` (the Clerk user ID).
5. That same string is the `User.id` in Postgres. There's no separate user table to sync; a `User` row is created lazily the first time you analyze, fork the demo, or install (with a placeholder email).

Why Clerk? The app never sees or stores passwords, and gets sign-up, sessions and GitHub login without writing them.

## 7.2 How "you can only see your own repos" is checked

There's no central permission layer. **Each route checks ownership itself**, usually like this:

```js
const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
if (!repo) return res.status(404).json({ error: 'Repo not found' });
```

Returning **404, not 403**, avoids even confirming that someone else's repo exists.

| Checks ownership ✅ | Doesn't check 💡 |
|---|---|
| `GET /api/repos` (filters by user) | `GET /api/repos/:id/snapshots` (`repos.js:20-31`) |
| chat POST + session list, root-cause, debate, tour | `GET /api/repos/:id/clusters` (`clusters.js:6-11`) |
| files neighbors + explain, settings GET/PATCH | `GET /api/snapshots/:id/insights` (`insights.js:6-12`) |
| findings PATCH + comments, API-key delete | `GET /api/findings?repoId=` (the `repoId` filter *replaces* the "my repos" filter, `findings.js:21`) |
| | `GET /api/repos/:id/chat/sessions/:sid` (checks repo match, not user, `chat.js:60-69`) |
| | **AI tools** (`tools.js`): take any `repoId`, and `find_repo` searches **all** users' repos |
| | **MCP tools**: the API key identifies the user, but `req.userId` is never passed to the tools |

All of these need someone to know another repo's random `cuid` ID. The AI-tool one is the most interesting, because the model can be *talked into* using another ID. 🎤 How to present it: *"Ownership checks are done per route, and I found a few routes that miss them. The fix is one reusable `requireRepoAccess` middleware, plus passing `userId` into every tool call instead of trusting the model's `repoId`."*

## 7.3 How API keys are stored (hashing)

`api/routes/apiKeys.js:17-37`:

```js
const raw    = `cp_${crypto.randomBytes(32).toString('hex')}`;        // 256 bits of randomness
const hashed = crypto.createHash('sha256').update(raw).digest('hex');  // store ONLY this
const prefix = raw.slice(0, 10);                                       // e.g. "cp_a1b2c3d4", shown in the UI
// ... save { key: hashed, prefix } ... return raw ONCE in the response
```

- **Hashing** = a one-way function: easy to go from key → hash, practically impossible to go back. If the database leaked, the attacker would get hashes, not usable keys. Comparison: a restaurant keeps a photo of your key's *shadow*. It can check that your key matches, but can't cut a new key from the photo.
- To check a key, the MCP server hashes what it receives and looks it up (`mcp/server.js:45-46`). `key` is unique, so it's one indexed query.
- **Why plain SHA-256 and not bcrypt?** bcrypt is deliberately slow so short human passwords can't be guessed quickly. A 256-bit random key can't be guessed anyway, so a fast hash is the standard choice for API tokens (GitHub does the same). 🎤 A common interview question.
- The raw key is shown **once**, and the list endpoint only returns `prefix` (`apiKeys.js:12`).

## 7.4 How GitHub App credentials are used

| Secret | Where | Used for |
|---|---|---|
| **Private key** (`.pem`, path in `GITHUB_PRIVATE_KEY_PATH`) | read in `octokit.js:16` | Signs a JWT proving "I am the App". Exchanged for **1-hour installation tokens** per user installation. Never sent anywhere itself. |
| **Webhook secret** (`GITHUB_WEBHOOK_SECRET`) | `verifyGithub.js:7` | HMAC check that webhooks really come from GitHub (Part 2b). |
| **Installation ID** (not secret) | `Repo.installationId` | Which installation's token to request when fetching files or posting PR comments. |
| **Public PAT** (`GITHUB_PUBLIC_PAT`, optional) | `publicOctokit.js`, `analyze.js`, `tools.js` | Raises the public-API rate limit from 60 to 5,000 requests/hour. |

Good practice already in place: secrets live in gitignored `.env` files, the key file is gitignored, tokens are short-lived and never cached (`getInstallationOctokit` is called per use), and the App only asks for read access to contents (plus Checks for PR results).

## 7.5 Security weak spots (framed for a student project)

For each: why it's OK for now → what I'd do for a real launch.

1. **Install callback trusts `state`** (Part 2c). One user today → a random one-time `state` tied to the session, and verify the installation belongs to that user.
2. **Missing ownership checks** on a few routes and in the AI/MCP tools (7.2) → a shared `requireRepoAccess` middleware, and pass `userId` into tools.
3. **Route order puts public endpoints behind login** (badge, Stripe webhook). This fails *closed* (safe), but breaks those features → mount public routes before the `/api` auth, or mount auth per router.
4. **MCP HTTP mode skips auth outside production** → require the key always, or only listen on localhost in dev.
5. **Socket.IO broadcasts everything to every client, with `cors: '*'`** → rooms + a login check when the socket connects.
6. **No request size limit** on the custom body reader (`index.js:37-50`) and **no rate limiting** → `express.json({ limit })` / `express.raw` for the webhook only, plus `express-rate-limit`, especially on the costly AI routes.
7. **Prompt injection:** the AI reads repo files, and a file could contain "ignore previous instructions...". The tools are read-only, which limits the damage. Real fix: scope tools to the user's own repos (item 2).
8. **Error messages returned to the client** (`err.message` in 500s) can leak internals → log details, return a generic message.
9. **No replay protection on webhooks** (`X-GitHub-Delivery`) → store delivery IDs for a day and ignore repeats.

---

# Part 9: Tests, and Running It Locally

## 9.1 What the tests cover

**39 Vitest tests** in `worker/test/`:

| File | Tests | What it proves | Real or fake |
|---|---|---|---|
| `unit/healthScore.test.js` | 14 | The formula: weights sum to 1, the caps, low vulns ignored, missing coverage not penalized, stays within 0–100 | Pure function (but see 9.2) |
| `coordination/handoff.test.js` | 21 | All 120 finishing orders hand off once; simultaneous finishes; failures only recorded on the final attempt; success beats failure; duplicates; late deliveries can't change a snapshot; aggregation twice → one snapshot; PR claim won once; every sweeper rule; sweeper is idempotent | **Real Postgres**, fake in-memory queue, fake Redis |
| `integration/pipeline.test.js` | 4 | The whole pipeline with **real BullMQ workers and retries**: jobs delivered twice → one snapshot; re-aggregation → still one; BullMQ really ignores a duplicate `jobId`; a category failing every real retry → run FAILED, not hung | **Real Postgres + real Redis + real BullMQ**. Only the 5 analysis functions and the PR poster are faked. |

**What they don't cover (be upfront):** the five analysis algorithms themselves (regex, npm audit, embeddings), every API route, Clerk auth, the dashboard, the AI agents, and the MCP server. There's no CI yet, so tests only run when you run them.

🎤 *Why test this part first?* "The coordination logic is where bugs are rare but serious (lost or duplicate runs) and hard to reproduce by hand. Concurrency bugs need tests that force every ordering. The analysis functions are simpler to check by eye."

**Safety guards worth mentioning:** tests refuse to run unless the database host is local **and** its name ends in `_test`, and Redis uses DB number 15, not 0 (`testEnv.js:12-21`). Inside each test file they double-check the actual connected database (`setup.js:6-9`). Tests `TRUNCATE` tables, so this protects your real data.

## 9.2 Running the tests

```bash
docker compose up -d
```

```bash
cd worker && npm install && npm test
```

- `globalSetup.js` runs `prisma migrate deploy` against `codepulse_test` before any test. If Postgres complains the database doesn't exist, create it once:

```bash
docker exec -it code_pulse-postgres-1 createdb -U codepulse codepulse_test
```

- 💡 Even the "unit" tests need Postgres running, because the global setup and `setup.js` connect to it for every file.
- `api/package.json` has `"test": "npm --prefix ../worker test"`, so `cd api && npm test` also works.

## 9.3 What `docker-compose.yml` starts

| Service | Image | Port on your machine | Login |
|---|---|---|---|
| Redis | `redis:7-alpine` | `6379` | none |
| Postgres + pgvector | `pgvector/pgvector:pg16` | **`5433`** (not the usual 5432, to avoid clashing with a local Postgres) | user / password / db = `codepulse` |

Both use named volumes (`redis_data`, `pg_data`), so data survives a restart.

## 9.4 Running the whole project locally, step by step

**1. Start the infrastructure**

```bash
docker compose up -d
```

**2. Environment files** (names only, never commit or show values):
- `api/.env`:
  - `DATABASE_URL` and `DIRECT_URL` (local: `postgresql://codepulse:codepulse@localhost:5433/codepulse`)
  - `REDIS_URL` (`redis://localhost:6379`)
  - `CLERK_SECRET_KEY`, `OPENAI_API_KEY`
  - `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_PATH`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_PUBLIC_PAT`
  - `FRONTEND_URL=http://localhost:3001`, `DEMO_REPO_SEED_ID` (optional), Stripe keys (optional)
- `worker/.env`: the same database, Redis, OpenAI and GitHub values (the worker imports API code, and `octokit.js` also loads `api/.env`), plus `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` (optional).
- `dashboard/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3000/api`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_GITHUB_APP_SLUG`.

**3. Install and set up the database**

```bash
cd api && npm install && npx prisma migrate deploy && npx prisma generate
```

```bash
cd worker && npm install
```

```bash
cd dashboard && npm install
```

**4. Run the three processes (three terminals)**

```bash
cd api && node index.js
```

```bash
cd worker && node index.js
```

```bash
cd dashboard && npm run dev -- -p 3001
```

💡 Plain `npm run dev` starts Next.js on port **3000**, which clashes with the API. Always pass `-p 3001`.

**5. Try it:** open `http://localhost:3001`, sign in, go to Dashboard, paste `https://github.com/<owner>/<small-js-repo>`, and watch the pipeline.

**Optional extras:**
- Webhooks: `ngrok http 3000`, then set the GitHub App's webhook URL to `<ngrok-url>/webhook`.
- MCP: run `cd mcp && npm install`, then point Claude Desktop at `node <path>/mcp/server.js`.
- Browse the database: `cd api && npx prisma studio` (opens `localhost:5555`).

**🎤 Pre-interview checklist:**
- Docker running; API, worker and dashboard all started.
- `GITHUB_PUBLIC_PAT` set.
- **Analyze your demo repo once beforehand**, so there's already a trend line and insights to show, then analyze again live.
- A small JS/TS repo URL copied and ready.
- `.env` and `.pem` files **closed** in your editor before you share your screen.

---

# Part 10: Interview Prep

## 10.1 The 3-minute spoken overview

> "CodePulse is a personal project I built to learn how real backend systems handle slow, parallel work. It gives a GitHub repository a health score from 0 to 100 and tracks it over time.
>
> You can start an analysis three ways: paste a public GitHub URL, install my GitHub App so every push triggers one, or load a demo repo. All three end in the same place: the API writes an `AnalysisRun` row to Postgres, then puts five jobs into Redis using BullMQ, one per check: complexity, dependency vulnerabilities through npm audit, unused exports, test coverage, and 'drift', where I embed each file with OpenAI and use pgvector to find files that don't resemble anything else in the repo.
>
> A separate worker process runs those five jobs in parallel. The interesting problem was coordination: how do you know when all five are done, exactly once, even if jobs are retried, delivered twice, or a worker crashes? Each worker saves its result as a row, then runs one conditional SQL update that only succeeds if the run is still running and all five result rows exist. Postgres's row locking means exactly one worker wins, and only that one queues the aggregator. A sweeper runs every minute to rescue anything a crash left stuck. I tested this with every one of the 120 possible finishing orders, and with real BullMQ retries.
>
> The aggregator computes a weighted score, saves a snapshot, creates findings, and pushes a live update. Workers publish progress to Redis pub/sub, and the API forwards it to the browser over Socket.IO, so you watch the pipeline run live.
>
> On top of that there's an AI layer: a chat and agents that use OpenAI tool calling to search code by embeddings, read files and look at diffs. The same tool definitions power an MCP server, so Claude Desktop can query CodePulse directly.
>
> It's Express, Next.js, Postgres with pgvector, Redis and BullMQ, Clerk for login, and Prisma. The pipeline core is the part I'm proudest of. The individual analyzers are deliberately simple approximations, and I can talk about how I'd make them more accurate."

## 10.2 The 10-minute screen-share tour

| Min | Open | What to show / say |
|---|---|---|
| 0–1 | The running app, `/repos/<id>` | The score, trend chart and insights. "This is the output; let me show how it gets here." Paste a URL on `/dashboard` and let it run in the background. |
| 1–2 | `api/prisma/schema.prisma` | `Repo` → `AnalysisRun` → `CategoryResult` → `Snapshot`. Point out `@@unique([runId, category])` and `runId @unique`. "The constraints do half the reliability work." |
| 2–3 | `api/routes/analyze.js` → `api/services/queue.js:22-46` | "Parse the URL, find the commit, upsert the repo, then *insert the run first, then enqueue five jobs with `jobId = runId`* so a duplicate add is ignored." |
| 3–4 | `worker/index.js:22-31` | Eight workers, the checks wrapped in `withRunTracking`. "The checks just compute; all the run rules live in one wrapper." |
| 4–6 | `worker/lib/runLifecycle.js` | `withRunTracking` → `recordCategoryOutcome` (success overwrites, failure doesn't) → **`advanceToAggregating` (`:91-103`)**. Explain "save first, then count" and the row lock. **The key two minutes.** |
| 6–7 | `worker/workers/aggregator.js` + `worker/lib/healthScore.js` | Score, snapshot upsert on `runId`, insights `jobId = snapshot.id`, the PR-comment claim, `SUCCEEDED` last. "Every step is safe to repeat." |
| 7–8 | `worker/lib/sweeper.js` | The three rules (AGGREGATING / RUNNING / QUEUED). "The normal path handles errors that throw; the sweeper handles crashes that don't." |
| 8–9 | `worker/test/coordination/handoff.test.js:58-82` | The 120-orderings test. Run `npm test` if there's time. |
| 9–10 | Back to the app | The pipeline has finished live. Then `api/services/tools.js` + `mcp/tools.js`: "one tool registry, two AI front ends". End with: "If I kept going: real per-function complexity, and a PARTIAL status instead of treating missing data as perfect." |

**Don't click during the demo:** ⌘K search, badges, `/owner/name` public pages, Stripe upgrade, the "Try demo" button (one data point only).

## 10.3 The 25 hardest questions, with short honest answers

1. **Why a queue at all? Why not analyze inside the HTTP request?**
   It's slow (hundreds of GitHub calls, npm audit, OpenAI). The request would time out, and a crash would take the API down. The queue gives retries, parallelism, and separate scaling.

2. **Why BullMQ/Redis and not a Postgres-based queue?**
   BullMQ gives retries, backoff, stalled-job detection and duplicate-safe job IDs out of the box. Postgres is the source of truth for *state*; Redis is only transport. A Postgres queue (e.g. pg-boss) would also work and remove one piece of infrastructure.

3. **How do you know all five checks are done?**
   Each saves a `CategoryResult` row, then runs one conditional `UPDATE ... WHERE status='RUNNING' AND (count of results) = 5`. It returns 1 for exactly one caller, who queues the aggregator.

4. **What if two workers run that UPDATE at the same moment?**
   Postgres locks the row for the first. The second waits, then re-checks its `WHERE` against the new row, sees `AGGREGATING`, and updates 0 rows.

5. **What if each worker counted *before* the others committed, so everyone saw 4?**
   Impossible here: each commits its own row *before* counting, so the last to commit always sees 5. That ordering is deliberate.

6. **Is processing exactly-once?**
   No, it's at-least-once with idempotent steps: upserts, unique constraints, job ID = run ID, snapshot keyed by run. Exactly-once *effects*, not exactly-once *execution*. The PR comment is the one at-most-once step.

7. **What happens if a worker process is killed mid-job?**
   BullMQ's lock expires, the job is redelivered, and re-running is safe. If it stalls again, BullMQ fails it, and the sweeper records FAILED so the run finishes.

8. **What if a check fails every retry?**
   The final attempt records a FAILED result, the handoff still happens, and the aggregator marks the run FAILED with the reason. It never hangs. The trade-off: one failure means no score.

9. **Why write the AnalysisRun before enqueueing?**
   So every job always points to a real run. The reverse gap (row without jobs) is caught by the sweeper after 10 minutes.

10. **Why does the aggregator job only carry `runId`?**
    So anything, including the sweeper, can re-queue it knowing only the ID. All inputs come from Postgres.

11. **Why `update: { commitSha }` in the snapshot upsert?**
    With an empty update, Prisma does SELECT-then-INSERT, which races. A non-empty update makes it one atomic `INSERT ... ON CONFLICT`.

12. **How accurate is the complexity score?**
    It's a regex approximation per file, not real cyclomatic complexity per function. It ranks files reasonably but over-penalizes large files. A real parser is the upgrade.

13. **Is the health score trustworthy?**
    As a trend for one repo, roughly. As an absolute number, no. Missing data (no lcov, no lockfile, failed fetches) counts as perfect, and push runs only look at changed files. I'd add a PARTIAL status and "unknown" categories.

14. **How does drift work, in plain words?**
    Embed each file. Find the 5 most similar files in the repo using pgvector cosine similarity. If even the best match is below 0.72, it's an outlier. It measures "doesn't fit in", not "changed".

15. **Why pgvector instead of a vector database?**
    Embeddings sit next to the relational data, one SQL query does the search, and there's no extra service. At this scale there's no need for an index or a separate store.

16. **How do you verify GitHub webhooks?**
    HMAC-SHA256 of the raw body with a shared secret, compared using `timingSafeEqual`. Raw bytes because re-serializing JSON changes them; constant-time to avoid timing attacks.

17. **How does the GitHub App authenticate?**
    Sign a JWT with the App's private key, exchange it plus the installation ID for a 1-hour installation token scoped to the chosen repos. Never cached, because it expires.

18. **How do you make sure users only see their own data?**
    Each route filters by `userId`, returning 404 if it isn't theirs. I found a few routes and the AI tools that miss this. The fix is a shared middleware and passing `userId` into tools.

19. **How are API keys stored?**
    SHA-256 hash of a 256-bit random key; the raw key is shown once. Fast hashing is fine because the key has too much randomness to guess, unlike a password.

20. **How do live updates work, and what if a message is lost?**
    Worker → Redis pub/sub → API → Socket.IO → browser. Pub/sub doesn't store messages, but Postgres has the data, so a refetch or reload fixes the view. I'd add rooms and a run-status endpoint.

21. **Why is the worker a separate process from the API?**
    Different workloads: the API must answer quickly; the worker does slow, CPU- and network-heavy work. They can restart and scale separately and only share Postgres and Redis.

22. **How does the AI agent avoid infinite tool loops?**
    Max 10 tool calls, 15 seconds per tool, 60 seconds total (`openAI.js:5-7`).

23. **What would break first at scale?**
    The GitHub rate limit (dead code fetches up to 300 files per run with no throttling), broadcasting every socket event to every client, and vector search without an index. Then the cost of one OpenAI embedding per file per run.

24. **What do your tests cover, and what's missing?**
    39 tests on the formula and the coordination: all orderings, duplicates, crashes, the sweeper, with real Postgres and real BullMQ. Missing: the analyzers, API routes, auth, the frontend, and CI.

25. **What would you do next?**
    (1) Make missing data explicit (PARTIAL / unknown) instead of perfect. (2) Analyze the whole repo at the pinned SHA on every run, not just changed files. (3) A real per-function complexity parser. (4) A shared ownership middleware and fixed route mounting. (5) GitHub rate-limit handling. (6) CI running the tests.

## 10.4 Every known weakness, with one sentence to say

| # | Weakness | What to say |
|---|---|---|
| 1 | Complexity is a regex, not escomplex | "I traded accuracy for simplicity; a proper parser is the next step." |
| 2 | Complexity is per file, but the cap assumes per function | "It over-penalizes big files, so most repos max out that category." |
| 3 | Dead code is name-based regex; ratio formula is wrong | "It's a rough signal, and I found a bug in the ratio's denominator." |
| 4 | Missing coverage = no penalty | "Unknown is scored as perfect; I'd show 'unknown' and re-weight instead." |
| 5 | Vulns only from a root `package-lock.json`; `npm audit` failures give 0 | "Other package managers look clean by default, which is misleading." |
| 6 | Drift = outlier-ness, order-dependent, fixed 0.72 | "It measures 'doesn't fit', and the threshold setting isn't wired to the worker yet." |
| 7 | Push runs analyze only changed files; install run analyzes none | "The score per push describes the push, not the repo; I'd analyze the full tree at the SHA." |
| 8 | Webhook/install runs fetch by branch name, not SHA | "A second push mid-run could mix versions; pinning the SHA fixes it." |
| 9 | One failed check → no score; `PARTIAL` unused | "I chose correctness over availability; PARTIAL is the planned middle ground." |
| 10 | Only complexity findings are ever created | "The other reports aren't in the shape the aggregator expects yet." |
| 11 | No failure event to the UI; no run-status endpoint | "The UI can show 'running' for a failed run; a status endpoint would fix it." |
| 12 | Socket.IO broadcasts to everyone, `cors: '*'` | "Fine for one user; rooms plus socket auth for many." |
| 13 | Some routes and all AI/MCP tools skip ownership checks | "Per-route checks are easy to forget; I'd centralize them." |
| 14 | Install `state` isn't verified | "It trusts the user ID in the redirect; a signed one-time state fixes that." |
| 15 | Badge, Stripe webhook, public page blocked by route order; `/health` missing | "Mounting order puts public routes behind auth: it fails safe, but breaks those features." |
| 16 | Search and PR-toggle routes not mounted | "Scaffolded but not switched on." |
| 17 | MCP HTTP skips auth outside production | "Convenient for local dev, but I'd always require the key." |
| 18 | No GitHub rate-limit handling; PAT optional | "Without a token, one medium repo can use the anonymous hourly limit." |
| 19 | Same commit analyzed twice → two snapshots | "Runs aren't de-duplicated by commit; easy to add." |
| 20 | Worker imports code from `api/` and needs the `.pem` | "Simple sharing, but it couples the two deployments; a shared package fixes it." |
| 21 | Leftovers: unused deps, `rag.js`, `notify.js`, `routes/index.js`, `FunctionMetric`, test page | "There's scaffolding from earlier plans I'd clean up." |
| 22 | No CI, no route/UI tests | "Tests focus on the riskiest part; CI and route tests are next." |
| 23 | README/CLAUDE.md describe the plan, not always the code | "The docs were my roadmap; the code is the source of truth." |
| 24 | No request size limit, no rate limiting, raw error messages | "Standard hardening I'd add before real users." |

## 10.5 One-page cheat sheet

**The flow in 8 steps**
1. Entry (URL / webhook / install) works out the user, repo, commit and files.
2. `createRunAndEnqueue`: **INSERT AnalysisRun (QUEUED)**, then add **5 jobs, `jobId = runId`**.
3. The worker's `withRunTracking` skips late duplicates and flips QUEUED → **RUNNING**.
4. Each check computes a report, then **saves a `CategoryResult`** (success overwrites, failure doesn't).
5. **`advanceToAggregating`**: one conditional UPDATE. Only the one who sees 5 rows **and** RUNNING wins → **AGGREGATING** → queue the aggregator.
6. Aggregator: any FAILED → run FAILED. Otherwise **score → Snapshot upsert on `runId`**.
7. Then insights + cluster jobs, findings, PR comment (claimed once), **health-update** through Redis → Socket.IO.
8. **SUCCEEDED** last. The **sweeper** (every 60s) rescues anything stuck.

**Key design decisions and why**

| Decision | Why |
|---|---|
| API and worker as separate processes, with a queue between | Fast responses; crash isolation; scale separately |
| Postgres = state, Redis = transport | Durable truth survives Redis loss; Redis is fast for queues and pub/sub |
| Run row before jobs | No orphan jobs; the sweeper covers the opposite gap |
| `jobId = runId` / `snapshot.id` | Duplicate enqueues are ignored |
| Unique constraints + upserts | Retries and duplicates are harmless (idempotent) |
| Save first, then conditional UPDATE | Exactly one handoff; no "everyone saw 4" |
| Aggregator job = `{ runId }` only | Anyone (the sweeper) can re-queue it |
| PR comment claimed before posting | At most once: better missing than spammed |
| Sweeper with idempotent actions | Recovers from crashes that never throw; safe to run many copies |
| pgvector inside Postgres | Similarity search with no extra service |
| One tool registry for chat and MCP | Write once, use in two AI front ends |
| Clerk JWTs | No password handling |
| Hashed API keys, raw shown once | A database leak doesn't leak usable keys |

**Key file names**
- `api/index.js`
- `api/services/queue.js`
- `api/routes/analyze.js` · `webhook.js` · `install.js`
- `api/middleware/requireClerk.js` · `verifyGithub.js`
- `worker/index.js`
- **`worker/lib/runLifecycle.js`** · `sweeper.js` · `healthScore.js` · `queues.js`
- `worker/workers/{complexity,vuln,deadcode,coverage,drift,aggregator,insights,cluster}.js`
- `api/services/tools.js` · `openAI.js` · `mcp/server.js` · `mcp/tools.js`
- `api/prisma/schema.prisma`
- `dashboard/lib/api.ts` · `dashboard/components/WorkerProgress.tsx`
- `worker/test/coordination/handoff.test.js`

**Numbers to remember:**
- 5 checks, 8 BullMQ workers, concurrency 5
- 5 attempts with 2s exponential backoff
- Sweeper every 60s; limits 2 min / 60 min / 10 min
- Weights 25 / 25 / 15 / 20 / 15
- Complexity cap = average 10; vuln points 10 / 5 / 2
- Drift threshold 0.72; embeddings 1,536 dimensions
- 200-file URL cap; 300-file dead-code cap
- Clusters: K = 4, only with ≥ 20 embedded files
- 16 tables, 11 migrations, 39 tests
- Agent limits: 10 tool calls, 15s per tool, 60s total

---

*End of guide. Part 3's check-your-understanding questions are still open above. Answer them any time for feedback.*
