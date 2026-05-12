import axios from 'axios'
import { repoSchema, snapshotSchema, type Repo, type Snapshot } from './schema'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

export async function getRepos(token: string): Promise<Repo[]> {                                                                                                                      
      try {       
          const { data } = await axios.get(`${API_URL}/repos`, {                                                                                                                        
              headers: { Authorization: `Bearer ${token}` }
          })                                                                                                                                                                            
          return repoSchema.array().parse(data)
      } catch (error) {
          console.error("Error fetching repos:", error)                                                                                                                                 
          return []
      }                                                                                                                                                                                 
  }               

export async function getSnapshots(repoId: string, token: string): Promise<Snapshot[]> {
      try {
          const { data } = await axios.get(`${API_URL}/repos/${repoId}/snapshots`, {
              headers: { Authorization: `Bearer ${token}` }
          })
          return snapshotSchema.array().parse(data)
      } catch (error) {
          console.error("Error fetching snapshots:", error)                                                                                                                             
          return []
      }                                                                                                                                                                                 
  }               

export async function analyzeRepo(url: string, token: string): Promise<{ repoId: string; commitSha: string }> {
    const { data } = await axios.post(`${API_URL}/analyze`, { repoUrl: url }, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return data
}

export async function forkDemo(token: string): Promise<{ repoId: string }> {
    const { data } = await axios.post(`${API_URL}/demo/fork`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return data
}

export async function getInsights(snapshotId: string, token: string): Promise<{
    topRisks?: string[]
    improvements?: string[]
    nextAction?: string
    pending?: boolean
}> {
    const { data } = await axios.get(`${API_URL}/snapshots/${snapshotId}/insights`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return data
}

export async function getTour(repoId: string, token: string): Promise<{
    steps: { title: string; description: string; files: string[]; insight: string }[]
}> {
    const { data } = await axios.post(`${API_URL}/repos/${repoId}/agents/tour`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return data
}
// Root cause agent streams SSE — return the raw Response so callers can read the stream
export async function getRootCause(repoId: string, metric: string, direction: 'drop' | 'spike', token: string): Promise<Response> {
  return fetch(`${API_URL}/repos/${repoId}/agents/root-cause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ metric, direction }),
  })
}

// ─── Phase 3 ────────────────────────────────────────────────────────────────

import type { Finding, RepoSettings, ApiKey, FileNeighbor } from './schema'

// Findings — accepts optional filter params, all optional
export async function getFindings(
  filters: { status?: string; type?: string; severity?: string; repoId?: string },
  token: string
): Promise<Finding[]> {
  const params = new URLSearchParams()
  if (filters.status)   params.set('status', filters.status)
  if (filters.type)     params.set('type', filters.type)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.repoId)   params.set('repoId', filters.repoId)
  const { data } = await axios.get(`${API_URL}/findings?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

export async function updateFinding(
  id: string,
  patch: { status?: string; dismissReason?: string; snoozedUntil?: string },
  token: string
): Promise<Finding> {
  const { data } = await axios.patch(`${API_URL}/findings/${id}`, patch, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

export async function addFindingComment(id: string, body: string, token: string) {
  const { data } = await axios.post(`${API_URL}/findings/${id}/comments`, { body }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

// Repo settings
export async function getRepoSettings(repoId: string, token: string): Promise<RepoSettings> {
  const { data } = await axios.get(`${API_URL}/repos/${repoId}/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

export async function updateRepoSettings(
  repoId: string,
  patch: Partial<RepoSettings>,
  token: string
): Promise<RepoSettings> {
  const { data } = await axios.patch(`${API_URL}/repos/${repoId}/settings`, patch, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

// API keys — GET returns list (no raw key), POST returns raw key once, DELETE revokes
export async function getApiKeys(token: string): Promise<ApiKey[]> {
  const { data } = await axios.get(`${API_URL}/settings/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

export async function createApiKey(name: string, token: string): Promise<ApiKey & { key: string }> {
  const { data } = await axios.post(`${API_URL}/settings/api-keys`, { name }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data  // includes raw `key` — only time it's ever visible
}

export async function deleteApiKey(id: string, token: string): Promise<void> {
  await axios.delete(`${API_URL}/settings/api-keys/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// File neighbors — finds semantically similar files via pgvector
export async function getFileNeighbors(repoId: string, path: string, token: string): Promise<FileNeighbor[]> {
  const { data } = await axios.get(`${API_URL}/repos/${repoId}/files/neighbors?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

// File explain — streams SSE, return Response so callers can read it
export async function explainFile(repoId: string, path: string, token: string): Promise<Response> {
  return fetch(`${API_URL}/repos/${repoId}/files/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path }),
  })
}
// Public repo info for badges and GitHub App readme links — no auth required, returns null if not found or private
export async function getPublicRepo(owner: string, name: string) {                                                                                                                    
    const res = await fetch(                                
      `${process.env.NEXT_PUBLIC_API_URL}/api/public/${owner}/${name}`
    )                                                                                                                                                                                   
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Failed to fetch repo')                                                                                                                                
    return res.json() as Promise<{                          
      repo: { id: string; owner: string; name: string; lastAnalyzedAt: string | null }
      snapshot: {                                                                                                                                                                       
        healthScore: number; complexity: number; vulnCount: number
        deadCode: number; coverage: number; driftScore: number                                                                                                                          
        commitSha: string; createdAt: string                                                                                                                                            
      } | null
    }>                                                                                                                                                                                  
  } 
export async function searchAll(q: string, token: string) {
    const res = await fetch(                                                                                                                                                            
      `${process.env.NEXT_PUBLIC_API_URL}/api/search?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }                                                                                                                                 
    )
    if (!res.ok) throw new Error('Search failed')                                                                                                                                       
    return res.json() as Promise<{                          
      repos:    { id: string; owner: string; name: string }[]                                                                                                                           
      findings: { id: string; repoId: string; title: string; severity: string }[]
      files:    { filePath: string; repoId: string }[]                                                                                                                                  
    }>                                                                                                                                                                                  
  }                                                        