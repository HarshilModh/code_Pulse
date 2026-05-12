'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Snapshot } from '@/lib/schema'
import { TrendingUp } from 'lucide-react'

export default function HealthTrend({ snapshots }: { snapshots: Snapshot[] }) {
  const data = [...snapshots].reverse().map(s => ({
    commit: s.commitSha.slice(0, 7),
    score: parseFloat(s.healthScore.toFixed(1)),
  }))

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-[var(--brand)]" />
        </div>
        <div>
          <h3 className="font-display text-[15px] font-medium text-[var(--ink)]">Health Score Trend</h3>
          <p className="font-tech text-[10px] text-[var(--ink-muted)]">across {data.length} commits</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
          <XAxis
            dataKey="commit"
            tick={{ fill: '#78716C', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#78716C', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E5E4',
              borderRadius: '8px',
              fontSize: '12px',
              padding: '8px 12px',
              boxShadow: '0 4px 12px rgba(15,14,12,0.06)',
            }}
            labelStyle={{ color: '#78716C', marginBottom: '4px', fontSize: '10px' }}
            itemStyle={{ color: '#059669', fontWeight: 600 }}
            cursor={{ stroke: '#E7E5E4', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={{ fill: '#059669', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#047857', r: 5, strokeWidth: 2, stroke: '#ECFDF5' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
