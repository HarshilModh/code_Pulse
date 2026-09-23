'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

type Member = {
  id: string
  filePath: string
  complexity: number
  driftScore: number | null
  isDead: boolean
}

type Cluster = {
  id: string
  label: string
  summary: string
  fileCount: number
  members: Member[]
}

type Edge = { source: string; target: string; weight: number }

// Default drift threshold (see CLAUDE.md) — a file is "drifting" when driftScore < this
const DRIFT_THRESHOLD = 0.72

// One color per cluster, applied by cluster order. Shared between the D3 canvas
// and the HTML legend so the swatches always match the bubbles.
const PALETTE = ['#059669', '#0891b2', '#7c3aed', '#d97706', '#db2777', '#65a30d']
const colorFor = (i: number) => PALETTE[i % PALETTE.length]

// Roll up the quality signals we already have per member into cluster-level stats.
// These drive the issue badge on each bubble and the chips in the drawer.
function clusterHealth(c: Cluster) {
  const drifting = c.members.filter(m => m.driftScore !== null && m.driftScore < DRIFT_THRESHOLD).length
  const dead = c.members.filter(m => m.isDead).length
  const avgComplexity = c.members.length
    ? c.members.reduce((s, m) => s + m.complexity, 0) / c.members.length
    : 0
  return { drifting, dead, avgComplexity, issues: drifting + dead }
}

// Worst-first ordering for the drawer: dead code, then drift, then raw complexity.
function memberSeverity(m: Member) {
  return (
    (m.isDead ? 1000 : 0) +
    (m.driftScore !== null && m.driftScore < DRIFT_THRESHOLD ? 500 : 0) +
    m.complexity
  )
}

export default function ClusterGraph({
  clusters,
  edges,
}: {
  clusters: Cluster[]
  edges: Edge[]
}) {
  const svgRef = useRef<SVGSVGElement>(null) // D3 draws into this SVG element
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null) // kept so the reset button can drive it
  const [selected, setSelected] = useState<Cluster | null>(null) // which cluster's drawer is open
  const [hovered, setHovered] = useState<string | null>(null)    // cluster id under the cursor (for legend sync)

  // Adjacency map: cluster id -> set of directly connected cluster ids.
  // Used to decide what stays lit when hovering a bubble.
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    clusters.forEach(c => map.set(c.id, new Set([c.id])))
    edges.forEach(e => {
      map.get(e.source)?.add(e.target)
      map.get(e.target)?.add(e.source)
    })
    return map
  }, [clusters, edges])

  useEffect(() => {
    if (!svgRef.current || clusters.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // wipe canvas before redrawing

    const width  = svgRef.current.clientWidth  || 800
    const height = svgRef.current.clientHeight || 640

    // Soft glow so bubbles read as "lit" objects rather than flat rings
    const defs = svg.append('defs')
    const glow = defs.append('filter').attr('id', 'bubble-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Everything zoomable/pannable lives inside this container <g>
    const container = svg.append('g')

    // Add radius `r` to each cluster — more files = bigger bubble.
    // Math.sqrt prevents large clusters from being overwhelmingly huge.
    const nodes: any[] = clusters.map((c, i) => ({
      ...c,
      i,
      r: Math.sqrt(c.fileCount) * 6 + 18,
      health: clusterHealth(c),
    }))

    // Copy edges so D3 can mutate source/target into object refs without touching props
    const links: any[] = edges.map(e => ({ ...e }))

    // Physics engine — runs many ticks until nodes settle into position
    const simulation = d3.forceSimulation(nodes)
      .force('link',    d3.forceLink(links).id((d: any) => d.id).distance(220)) // edges pull nodes together
      .force('charge',  d3.forceManyBody().strength(-500))                       // nodes push each other apart
      .force('center',  d3.forceCenter(width / 2, height / 2))                  // pull everything toward canvas center
      .force('collide', d3.forceCollide((d: any) => d.r + 16))                  // prevent bubbles from overlapping

    // Draw edges first so they appear behind the bubbles
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight) * 2) // heavier line = more shared files

    // Each node is a <g> group so circle + labels + badge move together as one unit
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_: any, d: any) => {
        setSelected(clusters.find(c => c.id === d.id) ?? null) // open drawer for clicked cluster
      })
      .on('mouseenter', (_: any, d: any) => setHovered(d.id))
      .on('mouseleave', () => setHovered(null))

    // The bubble ring — low fill opacity gives a glassy see-through effect
    node.append('circle')
      .attr('r',            (d: any) => d.r)
      .attr('fill',         (d: any) => colorFor(d.i))
      .attr('fill-opacity', 0.15)
      .attr('stroke',       (d: any) => colorFor(d.i))
      .attr('stroke-width', 2)
      .attr('filter', 'url(#bubble-glow)')

    // Cluster name — centered in the bubble
    node.append('text')
      .text((d: any) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')    // nudge down to visually center
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#f1f5f9')
      .style('pointer-events', 'none') // let clicks fall through to the group

    // File count — shown just below the name
    node.append('text')
      .text((d: any) => `${d.fileCount} files`)
      .attr('text-anchor', 'middle')
      .attr('dy', '1.6em')     // push below the name text
      .attr('font-size', '10px')
      .attr('fill', '#94a3b8')
      .style('pointer-events', 'none')

    // Issue badge — only drawn when a cluster has drifting/dead files.
    // Sits at the top-right of the bubble like a notification pill.
    const badge = node.filter((d: any) => d.health.issues > 0)
      .append('g')
      .attr('transform', (d: any) => `translate(${d.r * 0.72}, ${-d.r * 0.72})`)
      .style('pointer-events', 'none')
    badge.append('circle')
      .attr('r', 11)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
    badge.append('text')
      .text((d: any) => d.health.issues)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', '#0f172a')

    // ---- Drag: let users pull bubbles around to untangle the layout ----
    const drag = d3.drag<any, any>()
      .on('start', (event, d) => {
        event.sourceEvent.stopPropagation()        // don't let the canvas pan at the same time
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y                       // pin while dragging
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null                     // release so physics resumes
      })
    node.call(drag)

    // ---- Zoom + pan on the whole canvas ----
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => container.attr('transform', event.transform))
    svg.call(zoom)
    zoomRef.current = zoom

    // ---- Hover focus: dim everything not connected to the hovered cluster ----
    node.on('mouseenter.focus', (_: any, d: any) => {
      const lit = adjacency.get(d.id) ?? new Set([d.id])
      node.transition().duration(150).style('opacity', (n: any) => (lit.has(n.id) ? 1 : 0.15))
      link.transition().duration(150).style('opacity', (l: any) =>
        l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.05,
      )
    })
    node.on('mouseleave.focus', () => {
      node.transition().duration(150).style('opacity', 1)
      link.transition().duration(150).style('opacity', 0.5)
    })

    // Each tick D3 updates x/y on every node — we just read and apply to the DOM
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`) // move the whole group
    })

    return () => { simulation.stop() } // tear down physics on unmount/redraw
  }, [clusters, edges, adjacency])

  // Reset zoom/pan back to the identity transform
  const resetView = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity)
  }

  return (
    // position:relative so the absolute-positioned overlays stay inside this div
    <div className="relative w-full h-[640px] bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden">
      {/* D3 draws inside this SVG */}
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-left controls + hint */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <button
          onClick={resetView}
          className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
        >
          Reset view
        </button>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          scroll to zoom · drag bubbles to arrange
        </span>
      </div>

      {/* Clickable legend — mirrors the bubble colors and surfaces issue counts */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 max-w-[60%]">
        {clusters.map((c, i) => {
          const { issues } = clusterHealth(c)
          const dimmed = hovered !== null && hovered !== c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md bg-black/30 hover:bg-black/50 border border-white/5 transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(i) }} />
              <span className="text-slate-200 truncate">{c.label}</span>
              <span className="text-slate-500">{c.fileCount}</span>
              {issues > 0 && (
                <span className="text-amber-400 font-medium">⚠{issues}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* File drawer — slides in when a cluster is clicked */}
      {selected && (() => {
        const health = clusterHealth(selected)
        const members = [...selected.members].sort((a, b) => memberSeverity(b) - memberSeverity(a))
        return (
          <div className="absolute top-0 right-0 h-full w-80 bg-[#0f172a]/95 backdrop-blur border-l border-white/10 overflow-y-auto p-4 z-20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">{selected.label}</h3>
              <button
                onClick={() => setSelected(null)} // close drawer
                className="text-slate-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{selected.summary}</p>

            {/* Stat chips — at-a-glance cluster health */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Stat label="Files" value={String(selected.fileCount)} />
              <Stat label="Avg complexity" value={health.avgComplexity.toFixed(1)} />
              <Stat label="Drifting" value={String(health.drifting)} tone={health.drifting ? 'warn' : 'ok'} />
              <Stat label="Dead code" value={String(health.dead)} tone={health.dead ? 'bad' : 'ok'} />
            </div>

            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="text-xs bg-white/5 rounded p-2">
                  <div className="text-slate-300 font-mono truncate">{m.filePath}</div>
                  <div className="flex gap-3 mt-1 text-slate-500">
                    <span>complexity {m.complexity.toFixed(1)}</span>
                    {/* only show if below the drift threshold */}
                    {m.driftScore !== null && m.driftScore < DRIFT_THRESHOLD && (
                      <span className="text-amber-400">⚠ drifting</span>
                    )}
                    {m.isDead && <span className="text-red-400">dead code</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// Small labelled stat chip used in the drawer header.
// `tone` tints the value when there's something worth noticing.
function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : tone === 'ok' ? 'text-emerald-400' : 'text-slate-100'
  return (
    <div className="bg-white/5 rounded-md px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}
