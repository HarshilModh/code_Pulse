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
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Health Score Trend</h3>
            <p className="text-[10px] text-zinc-500">across {data.length} commits</p>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="commit"
            tick={{ fill: '#52525b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#52525b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              fontSize: '12px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#a1a1aa', marginBottom: '4px', fontSize: '10px' }}
            itemStyle={{ color: '#60a5fa', fontWeight: 600 }}
            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#60a5fa', r: 5, strokeWidth: 2, stroke: '#18181b' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
