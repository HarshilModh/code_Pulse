# CodePulse setup and reference

Back to the [README](../README.md).

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Docker** (for local PostgreSQL + Redis)
- **GitHub App**: [Create one](https://docs.github.com/en/apps/creating-github-apps) with `push` webhook events and repository read permissions
- **OpenAI API Key**: For embeddings and AI agents
- **Clerk Account**: For authentication

### 1. Clone the repository

```bash
git clone https://github.com/HarshilModh/code_Pulse.git
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
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM=price_...
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
# Terminal 1: API
cd api && npm start

# Terminal 2: Worker
cd worker && npm start

# Terminal 3: Dashboard
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
| `STRIPE_SECRET_KEY` | API | Stripe secret key for payment processing |
| `STRIPE_WEBHOOK_SECRET` | API | Webhook secret to verify Stripe webhook signatures |
| `STRIPE_PRICE_PRO` | API | Price ID for the Pro subscription tier |
| `STRIPE_PRICE_TEAM` | API | Price ID for the Team subscription tier |
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
│   ├── index.js                  # Entry point: routes, Socket.IO, Redis Pub/Sub
│   ├── middleware/
│   │   └── requireClerk.js       # Clerk JWT verification middleware
│   ├── routes/
│   │   ├── analyze.js            # POST /api/analyze: enqueue analysis jobs
│   │   ├── repos.js              # CRUD for repositories
│   │   ├── findings.js           # Findings CRUD + triage
│   │   ├── chat.js               # AI chat with tool-calling
│   │   ├── search.js             # Global search (route not mounted yet)
│   │   ├── badge.js              # Public SVG health badge
│   │   ├── webhook.js            # GitHub push webhook handler
│   │   ├── demo.js               # Demo repository fork
│   │   ├── files.js              # File-level analysis data
│   │   ├── settings.js           # Per-repo settings (drift threshold, digest)
│   │   ├── apiKeys.js            # API key management
│   │   ├── install.js            # GitHub App installation callback
│   │   ├── insights.js           # AI-generated snapshot insights
│   │   ├── stripe.js             # Stripe checkout & webhook endpoints
│   │   ├── clusters.js           # Semantic grouping endpoints
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
│   ├── index.js                  # Entry point: registers all workers + cron
│   ├── workers/
│   │   ├── complexity.js         # Cyclomatic complexity (branch and operator count)
│   │   ├── vuln.js               # Vulnerability scanning (npm audit)
│   │   ├── deadcode.js           # Dead code: exports nothing imports
│   │   ├── coverage.js           # Test coverage analysis
│   │   ├── drift.js              # Architectural drift (pgvector embeddings)
│   │   ├── aggregator.js         # Score aggregation + snapshot + findings
│   │   ├── insights.js           # AI insight generation per snapshot
│   │   └── cluster.js            # Semantic grouping via K-Means + GPT
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

### Analysis, Metrics & Semantic Map
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos/:id/snapshots` | Get snapshot history for a repository |
| `GET` | `/api/snapshots/:id/insights` | Get AI-generated insights for a snapshot |
| `GET` | `/api/repos/:id/files` | Get file-level analysis data |
| `GET` | `/api/repos/:id/clusters` | Get semantic file clusters and edge relations for modular mapping |

### Billing (Stripe)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/stripe/checkout` | Create Stripe Checkout session for subscription tier upgrade |
| `POST` | `/api/stripe/webhook` | Stripe public webhook for plan upgrades, lifecycle renewals, cancellations |

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

The application uses **16 models** managed by Prisma:

- **User**: Clerk-synced user with plan levels and repo limits, and Stripe metadata
- **Repo**: GitHub repository (supports App installs and public URL analysis)
- **Snapshot**: Point-in-time health score with all metric dimensions
- **FileAnalysis**: Per-file complexity, dead code status, drift score, and pgvector embedding
- **Cluster**: Semantic grouping of files computed via K-Means centroids, with OpenAI summaries
- **FunctionMetric**: Per-function cyclomatic complexity within a file
- **Finding**: Actionable issue (vuln, complexity, drift, dead code) with triage workflow
- **FindingComment**: Threaded comments on findings
- **Insight**: AI-generated top risks, improvements, and next action per snapshot
- **ChatSession / ChatMessage**: Persistent AI chat sessions with tool call history
- **RepoSettings**: Per-repo configuration (drift threshold, digest cadence, alert rules)
- **DigestLog**: Record of sent weekly digest emails
- **ApiKey**: User API keys (SHA-256 hashed, prefix-displayed)
- **AnalysisRun**: One analysis pass per push, with its state so retries are safe
- **CategoryResult**: Idempotent per-category result for each run, read by the aggregator

