import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SSOCallback() {
  // This page handles the OAuth redirect back from GitHub/Google and completes the auth flow
  return (
    <div className="min-h-screen w-full bg-[var(--canvas)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-[var(--brand)] animate-ping" />
        <p className="font-tech text-[12px] text-[var(--ink-muted)] uppercase tracking-widest">Authenticating</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
