'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getRepoSettings, updateRepoSettings } from '@/lib/api'
import { ArrowLeft, Check } from 'lucide-react'

const settingsSchema = z.object({
  driftThreshold:   z.number().min(0).max(1),
  digestCadence:    z.enum(['daily', 'weekly', 'never']),
  digestRecipients: z.string(),
})
type SettingsForm = z.infer<typeof settingsSchema>

export default function RepoSettingsPage() {
  const { id } = useParams()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', id],
    queryFn: async () => {
      const token = await getToken()
      return getRepoSettings(id as string, token!)
    },
    enabled: isLoaded && !!isSignedIn && !!id,
  })

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { driftThreshold: 0.72, digestCadence: 'weekly', digestRecipients: '' },
  })

  useEffect(() => {
    if (settings) {
      reset({
        driftThreshold:   settings.driftThreshold,
        digestCadence:    settings.digestCadence as 'daily' | 'weekly' | 'never',
        digestRecipients: settings.digestRecipients.join(', '),
      })
    }
  }, [settings, reset])

  const { mutate: save, isPending, isSuccess } = useMutation({
    mutationFn: async (form: SettingsForm) => {
      const token = await getToken()
      return updateRepoSettings(id as string, {
        driftThreshold:   form.driftThreshold,
        digestCadence:    form.digestCadence,
        digestRecipients: form.digestRecipients.split(',').map(s => s.trim()).filter(Boolean),
      }, token!)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', id], updated)
    },
  })

  const driftThreshold = watch('driftThreshold')

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-12 w-full flex-1">

      {/* Back link */}
      <Link
        href={`/repos/${id}`}
        className="inline-flex items-center gap-1.5 font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors mb-10"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </Link>

      {/* Page header */}
      <div className="mb-10">
        <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
          — Settings
        </div>
        <h1 className="font-display text-4xl font-medium text-[var(--ink)] tracking-tighter leading-[1]">
          Repo settings
        </h1>
        <p className="font-tech text-[12px] text-[var(--ink-muted)] mt-2">
          Changes apply on the next health check
        </p>
      </div>

      <form onSubmit={handleSubmit(d => save(d))} className="space-y-4">

        {/* Drift threshold */}
        <div className="card p-6">
          <label htmlFor="driftThreshold" className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight block mb-1">
            Drift threshold
            <span className="font-tech text-[13px] font-normal text-[var(--brand)] ml-2 tnum">
              {Number(driftThreshold).toFixed(2)}
            </span>
          </label>
          <p className="font-tech text-[11px] text-[var(--ink-muted)] mb-4">
            Files below this cosine similarity are flagged as drifting. Default 0.72 — lower is stricter.
          </p>
          <input
            id="driftThreshold"
            type="range"
            min={0} max={1} step={0.01}
            {...register('driftThreshold', { valueAsNumber: true })}
            className="w-full accent-[var(--brand)]"
          />
          {errors.driftThreshold && (
            <p className="font-tech text-[11px] text-[var(--signal-vuln)] mt-2">{errors.driftThreshold.message}</p>
          )}
        </div>

        {/* Digest cadence */}
        <div className="card p-6">
          <label htmlFor="digestCadence" className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight block mb-1">
            Email digest
          </label>
          <p className="font-tech text-[11px] text-[var(--ink-muted)] mb-4">
            How often to receive a summary email of new findings.
          </p>
          <select
            id="digestCadence"
            {...register('digestCadence')}
            className="w-full bg-[var(--canvas)] border border-[var(--rule)] text-[var(--ink)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="never">Never</option>
          </select>
        </div>

        {/* Recipients */}
        <div className="card p-6">
          <label htmlFor="digestRecipients" className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight block mb-1">
            Digest recipients
          </label>
          <p className="font-tech text-[11px] text-[var(--ink-muted)] mb-4">
            Comma-separated email addresses to receive digests.
          </p>
          <input
            id="digestRecipients"
            type="text"
            placeholder="alice@example.com, bob@example.com"
            {...register('digestRecipients')}
            className="w-full bg-[var(--canvas)] border border-[var(--rule)] text-[var(--ink)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--ink-subtle)] transition-all"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending || !isDirty}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white rounded-full transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', boxShadow: '0 1px 3px rgba(5,150,105,0.3)' }}
          >
            {isPending ? 'Saving…' : 'Save settings'}
          </button>

          {isSuccess && !isDirty && (
            <span className="inline-flex items-center gap-1 font-tech text-[12px] text-[var(--signal-coverage)]">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
