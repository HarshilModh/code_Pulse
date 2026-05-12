import { z } from 'zod'

export const repoSchema = z.object({
  id: z.string(),                                                                                                                                                                     
  githubRepoId: z.number(),                                                                                                                                                           
  owner: z.string(),                                                                                                                                                                  
  name: z.string(),                                                                                                                                                                   
  installationId: z.number().nullable(),
  source: z.string().optional().default('github-app'),
  defaultBranch: z.string().optional().default('main'),
  isPublicDemo: z.boolean().optional().default(false),
  lastAnalyzedAt: z.string().nullable().optional().default(null),                                                                                                                                              
  userId: z.string(),
  createdAt: z.string(),    
})

export const snapshotSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  commitSha: z.string(),
  healthScore: z.number(),
  complexity: z.number(),
  vulnCount: z.number(),
  deadCode: z.number(),
  coverage: z.number(),
  driftScore: z.number(),
  createdAt: z.string(),
})

export type Repo = z.infer<typeof repoSchema>
export type Snapshot = z.infer<typeof snapshotSchema>

// Phase 3 types — not Zod-validated because the API shapes are stable

export type FindingComment = {
  id: string
  userId: string
  body: string
  createdAt: string
}

export type Finding = {
  id: string
  repoId: string
  type: string        // vuln | complexity | drift | dead_code | ai_review
  severity: string    // critical | high | medium | low
  filePath: string | null
  line: number | null
  title: string
  body: string
  status: string      // open | acknowledged | resolved | dismissed | wont_fix
  createdAt: string
  comments: FindingComment[]
  repo?: { owner: string; name: string }  // populated when showRepo is true
}

export type RepoSettings = {
  repoId: string
  driftThreshold: number   // 0–1, default 0.72
  digestCadence: string    // weekly | daily | never
  digestRecipients: string[]
  alertRules: unknown[]
}

export type ApiKey = {
  id: string
  name: string
  prefix: string           // first 10 chars of raw key, safe to display
  createdAt: string
  lastUsedAt: string | null
}

export type FileNeighbor = {
  filePath: string
  complexity: number
  isDead: boolean
  driftScore: number | null
  similarity: string  // "0.923" — string because it's pre-formatted on the server
}
