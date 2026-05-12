<p align="center">
  <img src="dashboard/public/icon.svg" width="72" alt="CodePulse" />
</p>

<h1 align="center">CodePulse</h1>
<p align="center">
  <strong>Repository Health Intelligence — powered by static analysis, vector search, and AI agents.</strong><br />
  <sub>Complexity · Vulnerabilities · Dead Code · Coverage · Architectural Drift — one score, every push.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/pgvector-Embeddings-336791?style=flat-square&logo=postgresql&logoColor=white" alt="pgvector" />
  <img src="https://img.shields.io/badge/BullMQ-Workers-DC382D?style=flat-square&logo=redis&logoColor=white" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk&logoColor=white" alt="Clerk" />
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#project-structure">Project Structure</a>
</p>

<br />

> **CodePulse** is a full-stack repository health intelligence platform that continuously analyzes your GitHub codebase across **five critical dimensions** — then surfaces actionable insights through a real-time dashboard, AI-powered agents, and automated alerts. Think of it as a **fitness tracker for your code**.

<br />

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://img.shields.io/badge/5-Analysis Workers-059669?style=for-the-badge" alt="" /><br />
      <sub>Complexity · Vulnerabilities · Dead Code · Coverage · Drift</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.shields.io/badge/4-AI Agents-7c3aed?style=for-the-badge" alt="" /><br />
      <sub>Chat · Root Cause · Debate · Codebase Tour</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.shields.io/badge/13-Database Models-2563eb?style=for-the-badge" alt="" /><br />
      <sub>Prisma ORM + pgvector embeddings</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.shields.io/badge/Real--Time-WebSocket-f59e0b?style=for-the-badge" alt="" /><br />
      <sub>Live health scores via Socket.IO</sub>
    </td>
  </tr>
</table>

---

## Features

### 🩺 Five-Signal Health Score

Every repository gets a single **0–100 health score**, computed from five weighted static analysis signals. Each signal is processed by a dedicated BullMQ worker running in parallel:

| Signal | Weight | Engine | What It Detects |
|:---|:---:|:---|:---|
| 🔴 **Complexity** | 25% | `escomplex` | Functions with high cyclomatic complexity |
| 🟠 **Vulnerabilities** | 25% | `npm audit` | Critical, high, and moderate CVEs in dependencies |
| 🟡 **Dead Code** | 15% | `ts-prune` | Unused exports and orphaned modules |
| 🔵 **Coverage** | 20% | CI artifacts | Test coverage gaps |
| 🟣 **Drift** | 15% | `pgvector` cosine similarity | Files that have architecturally diverged from their module |

<br />

### 🤖 AI-Powered Agents

Four specialized agents, all streaming via SSE with OpenAI tool-calling and full access to your codebase:

<table>
  <tr>
    <td width="25%" align="center"><strong>💬 Chat</strong><br /><sub>Ask anything about your repo. Has access to semantic search, file reading, metrics, diffs, and findings.</sub></td>
    <td width="25%" align="center"><strong>🔬 Root Cause</strong><br /><sub>Give it a finding — it investigates the codebase and identifies the underlying root cause.</sub></td>
    <td width="25%" align="center"><strong>⚔️ Debate</strong><br /><sub>Two GPT personas argue FOR and AGAINST a technical decision using real repo evidence. 3 rounds.</sub></td>
    <td width="25%" align="center"><strong>🗺️ Tour</strong><br /><sub>Generates a guided walkthrough of any repository, highlighting key files and architecture.</sub></td>
  </tr>
</table>

<br />

### ⚡ And More

| Feature | Description |
|:---|:---|
| 🔍 **Semantic Code Search** | Files embedded with `text-embedding-3-small` + `pgvector`. The `⌘K` palette searches repos, findings, and code simultaneously. |
| 📋 **Findings Tracker** | Auto-generated, deduplicated issues (vuln, complexity, drift, dead code) with full triage workflow — snooze, resolve, dismiss, comment. |
| 📡 **Real-Time WebSocket** | Health scores push to all connected dashboards the instant analysis completes. Zero polling. |
| 🏷️ **README Badge** | Embeddable SVG badge: `![health](https://api.codepulse.dev/api/public/badge/owner/repo.svg)` |
| 📬 **Weekly Digest** | Cron-driven HTML email summaries via Resend — configurable per-repo recipients. |
| 📝 **PR Comments** | Auto-posts health score breakdowns directly in your pull request. |
| 🔑 **API Keys** | SHA-256 hashed personal keys for programmatic access. |
| 📱 **GitHub App** | Auto-analyze on every push via webhooks. Also supports public URL analysis for any repo. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     DASHBOARD (Next.js 16)                   │
│  React 19 · Clerk Auth · TanStack Query · D3/Recharts        │
│  Socket.IO Client · ⌘K Command Palette                      │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST + SSE + WebSocket
┌────────────────────────▼─────────────────────────────────────┐
│                     API SERVER (Express 5)                    │
│  Clerk JWT Auth · BullMQ Producer · Socket.IO Server         │
│  OpenAI Chat + Tool-Calling · GitHub Octokit                 │
└──────┬─────────────────┬──────────────────┬──────────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼───────┐  ┌───────▼───────┐
│  PostgreSQL  │  │    Redis      │  │   Worker      │
│  (pgvector)  │  │  (BullMQ +    │  │  (BullMQ      │
│  via Prisma  │  │   Pub/Sub)    │  │   Consumer)   │
└─────────────┘  └───────────────┘  └───────────────┘
                                     ├─ complexity
                                     ├─ vuln
                                     ├─ deadcode
                                     ├─ coverage
                                     ├─ drift
                                     ├─ aggregator
                                     └─ insights (AI)
```

### Analysis Pipeline

1. **Trigger** — A GitHub webhook (`push` event) or manual URL submission enqueues an analysis job.
2. **Fan-out** — The API enqueues five parallel worker jobs: `complexity`, `vuln`, `deadcode`, `coverage`, and `drift`.
3. **Aggregation** — Once all five complete, the `aggregator` worker computes the weighted health score, creates a `Snapshot`, emits `Finding` rows, and posts a PR comment.
4. **Insights** — The aggregator enqueues an `insights` job that sends the snapshot to GPT to generate top risks, improvement suggestions, and a recommended next action.
5. **Broadcast** — The aggregator publishes a Redis Pub/Sub message, which the API relays to all connected dashboards via Socket.IO.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | REST API server |
| **Prisma ORM** | Database access and migrations |
| **PostgreSQL + pgvector** | Relational data + vector similarity search |
| **BullMQ + Redis** | Job queue for analysis workers |
| **Socket.IO** | Real-time dashboard updates |
| **OpenAI API** | Embeddings (`text-embedding-3-small`) + Chat completions with tool-calling |
| **Octokit** | GitHub API access (App + public) |
| **Clerk** | JWT authentication (backend verification) |
| **Resend** | Transactional email delivery |
| **node-cron** | Scheduled weekly digest emails |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS 4** | Utility-first styling |
| **Clerk** | Authentication (OAuth — GitHub, Google) |
| **TanStack Query** | Server state management and caching |
| **Recharts + D3** | Data visualization (health trends, scatter plots, heatmaps) |
| **cmdk** | Command palette (⌘K) |
| **Socket.IO Client** | Real-time health score updates |
| **Zod + React Hook Form** | Form validation |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker Compose** | Local PostgreSQL (pgvector) + Redis |
| **Neon** | Managed PostgreSQL in production |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Docker** (for local PostgreSQL + Redis)
- **GitHub App** — [Create one](https://docs.github.com/en/apps/creating-github-apps) with `push` webhook events and repository read permissions
- **OpenAI API Key** — For embeddings and AI agents
- **Clerk Account** — For authentication

### 1. Clone the repository

```bash
git clone https://github.com/your-username/code_Pulse.git
cd code_Pulse
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts **PostgreSQL** (with pgvector, on port `5433`) and **Redis** (port `6379`).

### 3. Configure environment variables

Copy the example and fill in your secrets:

```bash
cp .env.example api/.env
cp .env.example worker/.env
```

See the [Environment Variables](#environment-variables) section for a full reference.

For the dashboard:

```bash
# dashboard/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_GITHUB_APP_SLUG=your-app-slug
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### 4. Set up the database

```bash
cd api
npm install
npx prisma generate
npx prisma db push
```

### 5. Install dependencies for all services

```bash
# From project root
cd api && npm install && cd ..
cd worker && npm install && cd ..
cd dashboard && npm install && cd ..
```

### 6. Start all services

Open three terminal tabs:

```bash
# Terminal 1 — API
cd api && npm start

# Terminal 2 — Worker
cd worker && npm start

# Terminal 3 — Dashboard
cd dashboard && npm run dev
```

The dashboard will be available at **http://localhost:3001** and the API at **http://localhost:3000**.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `GITHUB_APP_ID` | API, Worker | Your GitHub App's numeric ID |
| `GITHUB_PRIVATE_KEY_PATH` | API, Worker | Path to the `.pem` private key file |
| `GITHUB_WEBHOOK_SECRET` | API | Random string for webhook HMAC verification |
| `GITHUB_CLIENT_ID` | API | GitHub App OAuth client ID |
| `GITHUB_CLIENT_SECRET` | API | GitHub App OAuth client secret |
| `DATABASE_URL` | API, Worker | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | API | PostgreSQL direct connection (for migrations) |
| `REDIS_URL` | API, Worker | Redis connection string |
| `OPENAI_API_KEY` | API, Worker | OpenAI API key for embeddings + chat |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Dashboard | Clerk publishable key |
| `CLERK_SECRET_KEY` | API, Dashboard | Clerk secret key for JWT verification |
| `NODE_ENV` | All | `development` or `production` |
| `PORT` | API | API server port (default: `3000`) |
| `FRONTEND_URL` | API | Dashboard URL for CORS (default: `http://localhost:3001`) |
| `DEMO_REPO_SEED_ID` | API | GitHub repo ID used for the demo fork feature |

---

## Project Structure

```
code_Pulse/
├── api/                          # Express API server
│   ├── index.js                  # Entry point — routes, Socket.IO, Redis Pub/Sub
│   ├── middleware/
│   │   └── requireClerk.js       # Clerk JWT verification middleware
│   ├── routes/
│   │   ├── analyze.js            # POST /api/analyze — enqueue analysis jobs
│   │   ├── repos.js              # CRUD for repositories
│   │   ├── findings.js           # Findings CRUD + triage
│   │   ├── chat.js               # AI chat with tool-calling
│   │   ├── search.js             # Global ⌘K search (repos, findings, semantic)
│   │   ├── badge.js              # Public SVG health badge
│   │   ├── webhook.js            # GitHub push webhook handler
│   │   ├── demo.js               # Demo repository fork
│   │   ├── files.js              # File-level analysis data
│   │   ├── settings.js           # Per-repo settings (drift threshold, digest)
│   │   ├── apiKeys.js            # API key management
│   │   ├── install.js            # GitHub App installation callback
│   │   ├── insights.js           # AI-generated snapshot insights
│   │   └── Agents/
│   │       ├── debate.js         # Multi-round AI debate agent
│   │       ├── root_Cause.js     # Root cause analysis agent
│   │       └── tour.js           # Codebase tour generator
│   ├── services/
│   │   ├── openAI.js             # OpenAI chat + streaming with tool execution
│   │   ├── tools.js              # Tool registry (search, metrics, files, diffs)
│   │   ├── embed.js              # text-embedding-3-small wrapper
│   │   ├── rag.js                # RAG context builder
│   │   ├── octokit.js            # GitHub App Octokit factory
│   │   ├── publicOctokit.js      # Public GitHub API client
│   │   ├── prComment.js          # PR comment creation/update
│   │   └── queue.js              # BullMQ queue factory
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── lib/
│       └── prisma.js             # Prisma client singleton
│
├── worker/                       # BullMQ consumer workers
│   ├── index.js                  # Entry point — registers all workers + cron
│   ├── workers/
│   │   ├── complexity.js         # Cyclomatic complexity analysis (escomplex)
│   │   ├── vuln.js               # Vulnerability scanning (npm audit)
│   │   ├── deadcode.js           # Dead code detection (ts-prune)
│   │   ├── coverage.js           # Test coverage analysis
│   │   ├── drift.js              # Architectural drift (pgvector embeddings)
│   │   ├── aggregator.js         # Score aggregation + snapshot + findings
│   │   └── insights.js           # AI insight generation per snapshot
│   ├── digest/
│   │   ├── cron.js               # Weekly cron scheduler
│   │   ├── sendDigest.js         # HTML digest email builder + Resend
│   │   └── runNow.js             # Manual digest trigger
│   └── lib/
│
├── dashboard/                    # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout (Clerk, fonts, nav)
│   │   ├── globals.css           # Design system (CSS variables, animations)
│   │   ├── not-found.tsx         # Custom 404 page
│   │   ├── dashboard/            # Authenticated dashboard (repo list)
│   │   ├── repos/[id]/           # Repository detail view
│   │   │   ├── chat/             # Full-page AI chat
│   │   │   ├── debate/           # AI debate interface
│   │   │   ├── files/            # File-level analysis explorer
│   │   │   ├── findings/         # Findings list + triage
│   │   │   └── settings/         # Repo settings
│   │   ├── findings/             # Global findings view
│   │   ├── pricing/              # Pricing page
│   │   ├── settings/api-keys/    # API key management
│   │   ├── sign-in/              # Custom OAuth login (GitHub, Google)
│   │   └── sign-up/              # Sign-up (shared OAuth UI)
│   ├── components/
│   │   ├── Nav.tsx               # Global navigation bar
│   │   ├── CommandPalette.tsx    # ⌘K command palette with global search
│   │   ├── ChatPannel.tsx        # Floating AI chat panel
│   │   ├── HealthTrend.tsx       # Health score sparkline chart
│   │   ├── FileHeatmap.tsx       # Complexity heatmap (D3)
│   │   ├── DriftScatter.tsx      # Architectural drift scatter plot (D3)
│   │   ├── InsightCards.tsx      # AI-generated insight display
│   │   ├── FindingCard.tsx       # Finding detail + triage actions
│   │   ├── WorkerProgress.tsx    # Real-time analysis progress
│   │   ├── RootCauseAgent.tsx    # Root cause investigation UI
│   │   ├── CodebaseTour.tsx      # Guided codebase tour
│   │   └── GlobalSearchBar.tsx   # Typeahead search component
│   └── lib/
│       └── api.ts                # API client (Axios)
│
├── docker-compose.yml            # Local PostgreSQL (pgvector) + Redis
└── .env.example                  # Environment variable template
```

---

## API Reference

All authenticated endpoints require a `Authorization: Bearer <clerk_jwt>` header.

### Repositories
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos` | List user's repositories |
| `POST` | `/api/analyze` | Trigger analysis for a repository URL |
| `POST` | `/api/demo/fork` | Fork the demo repository for first-time users |

### Analysis & Metrics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos/:id/snapshots` | Get snapshot history for a repository |
| `GET` | `/api/snapshots/:id/insights` | Get AI-generated insights for a snapshot |
| `GET` | `/api/repos/:id/files` | Get file-level analysis data |

### Findings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos/:id/findings` | List findings for a repository |
| `PATCH` | `/api/findings/:id` | Update finding status (triage) |
| `POST` | `/api/findings/:id/comments` | Add a comment to a finding |

### AI Agents
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/repos/:id/chat` | Send a message to the AI chat agent (SSE stream) |
| `POST` | `/api/repos/:id/agents/debate` | Start an AI debate on a topic (SSE stream) |
| `POST` | `/api/repos/:id/agents/root-cause` | Run root cause analysis (SSE stream) |
| `POST` | `/api/repos/:id/agents/tour` | Generate a codebase tour (SSE stream) |

### Search
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=<term>` | Global search (repos, findings, semantic files) |

### Public
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/badge/:owner/:name.svg` | Health score SVG badge |
| `GET` | `/api/public/repos/:owner/:name` | Public repo + snapshot data |

### Settings & Keys
| Method | Endpoint | Description |
|---|---|---|
| `GET/PUT` | `/api/repos/:id/settings` | Repository settings (drift threshold, digest) |
| `GET/POST/DELETE` | `/api/api-keys` | Manage API keys |

---

## Database Schema

The application uses **13 models** managed by Prisma:

- **User** — Clerk-synced user with plan and repo limit
- **Repo** — GitHub repository (supports App installs and public URL analysis)
- **Snapshot** — Point-in-time health score with all five metric dimensions
- **FileAnalysis** — Per-file complexity, dead code status, drift score, and pgvector embedding
- **FunctionMetric** — Per-function cyclomatic complexity within a file
- **Finding** — Actionable issue (vuln, complexity, drift, dead code) with triage workflow
- **FindingComment** — Threaded comments on findings
- **Insight** — AI-generated top risks, improvements, and next action per snapshot
- **ChatSession / ChatMessage** — Persistent AI chat sessions with tool call history
- **RepoSettings** — Per-repo configuration (drift threshold, digest cadence, alert rules)
- **DigestLog** — Record of sent weekly digest emails
- **ApiKey** — User API keys (SHA-256 hashed, prefix-displayed)

---

## License

This project is for educational and portfolio purposes.

---

<p align="center">
  Built with 💚 by <a href="https://github.com/HarshilModh">Harshil Modh</a>
</p>
