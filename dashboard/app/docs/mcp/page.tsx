import Link from 'next/link'

const TOOLS = [
  { name: 'search_code',          desc: 'Semantic search over all analyzed files using pgvector.' },
  { name: 'get_metrics',          desc: 'Health score and signals for a repo, or per-file metrics.' },
  { name: 'get_snapshot_history', desc: 'Time-series of health snapshots for trend analysis.' },
  { name: 'get_findings',         desc: 'List open findings — filter by status.' },
  { name: 'read_file',            desc: 'Read the contents of any file in the repo.' },
  { name: 'get_diff',             desc: 'Get the file-level patch for a specific commit SHA.' },
]

const PROMPTS = [
  'What is the current health score for repo <id>?',
  'Find files related to authentication in repo <id>.',
  'Show me all open findings for repo <id>.',
  'Read the contents of src/auth/middleware.js in repo <id>.',
  'What changed in commit abc123 in repo <id>?',
]

export default function McpDocsPage() {
  return (
    <div className="w-full bg-[var(--canvas)]">

      {/* Hero */}
      <section className="relative px-6 sm:px-10 pt-20 pb-16 overflow-hidden text-center">
        <div className="hero-blobs">
          <div className="blob indigo" />
          <div className="blob violet" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-6">
            — MCP Server
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-[var(--ink)] tracking-tighter font-medium leading-[0.95] mb-6">
            Query your codebase <br />
            <span className="italic tri-gradient brand-gradient-animated">from any AI assistant.</span>
          </h1>
          <p className="text-lg text-[var(--ink-soft)] max-w-xl mx-auto">
            CodePulse ships a Model Context Protocol server. Connect Claude Desktop, Cursor, or any
            MCP-compatible client and ask questions about health scores, findings, and files directly
            in your AI chat.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 sm:px-10 pb-32 space-y-14">

        {/* Claude Desktop quick-start */}
        <section>
          <h2 className="font-display text-2xl text-[var(--ink)] font-medium mb-2">Claude Desktop (stdio)</h2>
          <p className="text-[14px] text-[var(--ink-soft)] mb-4">
            Add this to your{' '}
            <span className="font-tech text-[var(--ink)]">claude_desktop_config.json</span>:
          </p>
          <pre className="card p-5 text-[13px] font-tech text-[var(--ink-soft)] overflow-x-auto whitespace-pre leading-relaxed">
{`{
  "mcpServers": {
    "codepulse": {
      "command": "npx",
      "args": ["-y", "@codepulse/mcp"]
    }
  }
}`}
          </pre>
          <p className="text-[13px] text-[var(--ink-muted)] mt-3">
            Restart Claude Desktop — the CodePulse tools will appear automatically. No API key needed for stdio.
          </p>
        </section>

        {/* HTTP mode */}
        <section>
          <h2 className="font-display text-2xl text-[var(--ink)] font-medium mb-2">HTTP / SSE mode</h2>
          <p className="text-[14px] text-[var(--ink-soft)] mb-4">
            For remote clients, run the server in HTTP mode and authenticate with an API key:
          </p>
          <pre className="card p-5 text-[13px] font-tech text-[var(--ink-soft)] overflow-x-auto whitespace-pre leading-relaxed">
{`# start
node mcp/server.js --http

# connect (SSE endpoint)
GET https://<your-mcp-url>/sse
X-Codepulse-Key: <your-api-key>`}
          </pre>
          <p className="text-[13px] text-[var(--ink-muted)] mt-3">
            Generate an API key in{' '}
            <Link href="/settings/api-keys" className="text-[var(--brand)] hover:underline">
              Settings → API Keys
            </Link>
            .
          </p>
        </section>

        {/* Available tools */}
        <section>
          <h2 className="font-display text-2xl text-[var(--ink)] font-medium mb-4">Available tools</h2>
          <div className="space-y-3">
            {TOOLS.map(t => (
              <div key={t.name} className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-tech text-[13px] text-[var(--brand)] shrink-0 sm:min-w-[220px]">
                  {t.name}
                </span>
                <span className="text-[13px] text-[var(--ink-soft)]">{t.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Example prompts */}
        <section>
          <h2 className="font-display text-2xl text-[var(--ink)] font-medium mb-4">Example prompts</h2>
          <div className="space-y-3">
            {PROMPTS.map(p => (
              <div key={p} className="card px-5 py-3 font-tech text-[13px] text-[var(--ink-soft)]">
                {p}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center pt-4">
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white rounded-full px-6 py-3 transition-all hover:brightness-110 cta-glow"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
          >
            Generate API key →
          </Link>
        </div>

      </div>
    </div>
  )
}
