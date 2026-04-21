'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Snapshot } from '@/lib/schema'
import { Radar } from 'lucide-react'

export default function DriftScatter({ snapshots }: { snapshots: Snapshot[] }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !snapshots.length) return

    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const margin = { top: 16, right: 16, bottom: 28, left: 36 }
    const width = (ref.current.clientWidth || 600) - margin.left - margin.right
    const height = 220 - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const data = [...snapshots].reverse().map((s, i) => ({
      index: i,
      drift: s.driftScore,
      commit: s.commitSha.slice(0, 7),
      health: s.healthScore,
    }))

    const xScale = d3.scaleLinear().domain([0, Math.max(1, data.length - 1)]).range([0, width])
    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0])

    // Threshold zone — below 0.72 is drift (shaded red)
    g.append('rect')
      .attr('x', 0).attr('y', yScale(0.72))
      .attr('width', width).attr('height', height - yScale(0.72))
      .attr('fill', '#ef4444').attr('opacity', 0.04)

    // Threshold line
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(0.72)).attr('y2', yScale(0.72))
      .attr('stroke', '#ef4444').attr('stroke-dasharray', '4 3')
      .attr('stroke-width', 1).attr('opacity', 0.5)

    g.append('text')
      .attr('x', width - 6).attr('y', yScale(0.72) - 5)
      .attr('text-anchor', 'end').attr('fill', '#ef4444')
      .attr('font-size', '9px').attr('font-weight', '500')
      .text('drift threshold · 0.72')

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(data.length, 8)).tickFormat((_, i) => {
        const step = Math.max(1, Math.floor(data.length / 8))
        return i * step < data.length ? data[i * step]?.commit ?? '' : ''
      }))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').attr('fill', '#52525b').attr('font-size', '9px'))
      .call(ax => ax.selectAll('line').attr('stroke', '#27272a'))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').attr('fill', '#52525b').attr('font-size', '9px'))
      .call(ax => ax.selectAll('line').attr('stroke', '#27272a').attr('stroke-dasharray', '2 2'))

    // Tooltip
    d3.select('body').select('#drift-tooltip').remove()
    const tip = d3.select('body').append('div')
      .attr('id', 'drift-tooltip')
      .style('position', 'fixed')
      .style('background', '#18181b')
      .style('border', '1px solid #3f3f46')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('color', '#e4e4e7')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '100')
      .style('box-shadow', '0 10px 30px rgba(0,0,0,0.3)')
      .style('transition', 'opacity 120ms')

    // Connecting line
    const line = d3.line<typeof data[0]>()
      .x(d => xScale(d.index))
      .y(d => yScale(d.drift))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3)
      .attr('d', line)

    // Dots
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => xScale(d.index))
      .attr('cy', d => yScale(d.drift))
      .attr('r', 4)
      .attr('fill', d => d.drift < 0.72 ? '#ef4444' : '#3b82f6')
      .attr('stroke', '#18181b')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('transition', 'r 120ms')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 6)
        tip.style('opacity', '1')
          .html(`<div style="font-weight:600;color:#fff">${d.commit}</div><div style="color:#a1a1aa;margin-top:2px">Drift: <span style="color:${d.drift < 0.72 ? '#f87171' : '#60a5fa'};font-weight:500">${d.drift.toFixed(3)}</span></div><div style="color:#a1a1aa">Health: <span style="color:#fff;font-weight:500">${d.health.toFixed(1)}</span></div>`)
      })
      .on('mousemove', (event) => {
        tip.style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 16}px`)
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4)
        tip.style('opacity', '0')
      })

  }, [snapshots])

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Radar className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Architectural Drift</h3>
            <p className="text-[10px] text-zinc-500">cosine similarity per commit</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Drifted
          </span>
        </div>
      </div>
      <svg ref={ref} width="100%" height={220} />
    </div>
  )
}
