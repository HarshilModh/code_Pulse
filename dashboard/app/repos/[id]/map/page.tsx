'use client';
import React from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { getClusters } from '@/lib/api'
import ClusterGraph from '@/components/ClusterGraph'
export default function MapPage() {

    const {id}=useParams<{id:string}>()
    const {getToken}=useAuth()
    const {data,isLoading}=useQuery({
      queryKey:["clusters",id],
      queryFn:async()=>{
        const token=await getToken()
        return getClusters(id,token!)
      }
    })
  if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96 text-slate-400">
          Loading cluster map...
        </div>
      )
    }

    if (!data || data.clusters.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
          <p className="text-slate-300 font-semibold text-lg">No cluster data yet</p>
          <p className="text-slate-500 text-sm max-w-xs">
            Cluster map requires 20+ analyzed files. Run an analysis to populate it.
          </p>
        </div>
      )
    }

    // Totals for the header summary — computed once from the loaded clusters
    const totalFiles = data.clusters.reduce((sum, c) => sum + c.fileCount, 0)
    const totalIssues = data.clusters.reduce(
      (sum, c) =>
        sum +
        c.members.filter(m => m.isDead || (m.driftScore !== null && m.driftScore < 0.72)).length,
      0,
    )

    return (
      <main className="p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Cluster Map</h1>
            <p className="text-slate-400 text-sm mt-1">
              {data.clusters.length} architectural groups across {totalFiles} files
            </p>
          </div>
          {totalIssues > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              ⚠ {totalIssues} file{totalIssues === 1 ? '' : 's'} need attention
            </span>
          )}
        </div>
        <ClusterGraph clusters={data.clusters} edges={data.edges} />
      </main>
    )
}