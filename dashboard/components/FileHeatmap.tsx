'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Snapshot } from '@/lib/schema'
import { Grid3x3 } from 'lucide-react'

export default function FileHeatmap({ snapshots }: { snapshots: Snapshot[] }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !snapshots.length) return

    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const data = [...snapshots].reverse()
    const cellSize = 28
    const padding = 4
    const width = ref.current.clientWidth || 600
    const cols = Math.max(1, Math.floor(width / (cellSize + padding)))

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([10, 0])

    const cells = svg.selectAll('g.cell')
      .data(data)
      .join('g')
      .attr('class', 'cell')
      .attr('transform', (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return `translate(${col * (cellSize + padding)}, ${row * (cellSize + padding)})`
      })

    cells.append('rect')
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 5)
      .attr('fill', d => colorScale(d.complexity))
      .attr('opacity', 0.85)
      .attr('stroke', '#E7E5E4')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 120ms')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1)
        tip.style('opacity', '1')
          .html(`<div style="font-weight:600;color:#0C0A09">${d.commitSha.slice(0, 7)}</div><div style="color:#78716C;margin-top:2px">Complexity: <span style="color:#0C0A09;font-weight:500">${d.complexity.toFixed(2)}</span></div>`)
      })
      .on('mousemove', (event) => {
        tip.style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 16}px`)
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.85)
        tip.style('opacity', '0')
      })

    d3.select('body').select('#heatmap-tooltip').remove()
    const tip = d3.select('body').append('div')
      .attr('id', 'heatmap-tooltip')
      .style('position', 'fixed')
      .style('background', '#FFFFFF')
      .style('border', '1px solid #E7E5E4')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('color', '#0C0A09')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '100')
      .style('box-shadow', '0 4px 12px rgba(15,14,12,0.08)')
      .style('transition', 'opacity 120ms')

  }, [snapshots])

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--signal-complexity-bg)] flex items-center justify-center">
            <Grid3x3 className="w-4 h-4 text-[var(--signal-complexity)]" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-medium text-[var(--ink)]">Complexity Heatmap</h3>
            <p className="font-tech text-[10px] text-[var(--ink-muted)]">per commit</p>
          </div>
        </div>
      </div>
      <svg ref={ref} width="100%" height={180} />
      <div className="flex items-center justify-between font-tech text-[10px] text-[var(--ink-muted)] mt-3 pt-3 border-t border-[var(--rule)]">
        <span>Low</span>
        <div className="flex-1 mx-2 h-1 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
        <span>High</span>
      </div>
    </div>
  )
}
