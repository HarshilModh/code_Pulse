import { z } from 'zod'

export const repoSchema = z.object({
  id: z.string(),
  githubRepoId: z.number(),
  owner: z.string(),
  name: z.string(),
  installationId: z.number(),
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
