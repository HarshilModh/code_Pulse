import { getInstallationOctokit } from './octokit.js'
import prisma from '../lib/prisma.js'

// Posts a health report as both a GitHub Check Run and a PR comment after
// the aggregator finishes a snapshot. Called from worker/workers/aggregator.js.
export async function postPRComment({ repoId, snapshotId }) {

  const repo = await prisma.repo.findUnique({ where: { id: repoId } })

  // Only GitHub App repos have an installationId — URL-analyzed repos skip this entirely
  if (!repo || repo.source !== 'github_app' || !repo.installationId) {
    return { error: 'Repo not found or unsupported source' }
  }

  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) return { error: 'Snapshot not found' }

  // Look up the previous snapshot to compute a score delta for the comment
  const previous = await prisma.snapshot.findFirst({
    where: { repoId, id: { not: snapshotId } },
    orderBy: { createdAt: 'desc' },
  })

  // delta is null on the very first scan — show "first scan" instead of a number
  const delta = previous ? snapshot.healthScore - previous.healthScore : null
  const deltaStr = delta === null
    ? 'first scan'
    : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)

  const score = snapshot.healthScore.toFixed(1)
  const label =
    snapshot.healthScore >= 80 ? 'Excellent' :
    snapshot.healthScore >= 60 ? 'Healthy' :
    snapshot.healthScore >= 40 ? 'Needs attention' : 'Critical'

  // Markdown body used for both the Check Run summary and the PR comment body
  const body = [
    `## CodePulse Health Report`,
    ``,
    `**Score: ${score} / 100** — ${label} (${deltaStr})`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Complexity | ${snapshot.complexity.toFixed(2)} |`,
    `| Vulnerabilities | ${snapshot.vulnCount} |`,
    `| Coverage | ${(snapshot.coverage * 100).toFixed(1)}% |`,
    `| Drift | ${snapshot.driftScore.toFixed(2)} |`,
    ``,
    `[View full dashboard →](${process.env.FRONTEND_URL}/repos/${repoId})`,
  ].join('\n')

  const octokit = await getInstallationOctokit(repo.installationId)

  // Score >= 60 passes, 40–59 is neutral (warning badge), below 40 fails the check
  const conclusion =
    snapshot.healthScore >= 60 ? 'success' :
    snapshot.healthScore >= 40 ? 'neutral' : 'failure'

  // 1. Post a GitHub Check Run — shows inline pass/fail on the commit and PR status area.
  // .catch so a missing Checks write permission doesn't crash the aggregator job.
  await octokit.rest.checks.create({
    owner: repo.owner,
    repo: repo.name,
    name: 'CodePulse Health',
    head_sha: snapshot.commitSha,
    status: 'completed',
    conclusion,
    output: {
      title: `Health Score: ${score} / 100 (${deltaStr})`,
      summary: body,
    },
  }).catch(err => console.warn('[prComment] check run failed:', err.message))

  // 2. Find every open PR that includes this commit and post the markdown body as a comment.
  // listPullRequestsAssociatedWithCommit returns merged PRs too — filter to open only.
  const { data: prs } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner: repo.owner,
    repo: repo.name,
    commit_sha: snapshot.commitSha,
  }).catch(() => ({ data: [] }))

  for (const pr of prs.filter(p => p.state === 'open')) {
    await octokit.rest.issues.createComment({
      owner: repo.owner,
      repo: repo.name,
      issue_number: pr.number,
      body,
    }).catch(err => console.warn(`[prComment] comment on PR #${pr.number} failed:`, err.message))
  }
}
