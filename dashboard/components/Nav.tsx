'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignInButton, Show, UserButton } from '@clerk/nextjs'
import { GlobalSearchBar } from './GlobalSearchBar'
// ECG logo — matches the BrandMark on the landing page
function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="nav-bm" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%"  stopColor="var(--brand-3)" />
          <stop offset="55%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <path
        d="M3 16 H8 L11 9 L15 23 L18 13 L21 18 H29"
        stroke="url(#nav-bm)" strokeWidth={2.4}
        fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export function Nav() {
  const pathname = usePathname() ?? '/'

  if (pathname === '/') return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="sticky top-0 z-50 bg-[var(--canvas)]/90 backdrop-blur-xl">

      {/* 1.5px brand gradient top strip — the signature of the product shell */}
      <div
        className="h-[1.5px] w-full"
        style={{ background: 'linear-gradient(90deg, var(--brand-3), var(--brand) 40%, var(--brand-2))' }}
      />

      <div className="max-w-6xl mx-auto px-6 sm:px-10 h-[52px] flex items-stretch gap-0">

        {/* Logo — ECG mark + wordmark + heartbeat dot */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mr-8 shrink-0 hover:opacity-75 transition-opacity outline-none"
        >
          <BrandMark className="w-5 h-5" />
          <span className="font-display text-[16px] font-semibold text-[var(--ink)] tracking-tight leading-none">
            codepulse
          </span>
          <span className="relative flex w-1.5 h-1.5 self-center">
            <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
            <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
          </span>
        </Link>

        {/* App links — brand-colored active state + 2px bottom bar */}
        <Show when="signed-in">
          <div className="hidden md:flex items-stretch">
            <NavLink href="/dashboard"         active={isActive('/dashboard')}>Dashboard</NavLink>
            <NavLink href="/findings"          active={isActive('/findings')}>Findings</NavLink>
            <NavLink href="/settings/api-keys" active={isActive('/settings')}>Settings</NavLink>
          </div>
        </Show>

        <div className="flex-1" />

        {/* Search pill — looks like a real input, not a hint */}
        <Show when="signed-in">
          <GlobalSearchBar />
        </Show>

        {/* Auth */}
        <div className="flex items-center">
          <Show when="signed-out">
            <SignInButton>
              <button
                className="text-[13px] font-medium text-white rounded-full px-4 py-1.5 transition-all hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                  boxShadow: '0 1px 3px rgba(79,70,229,0.3), 0 4px 12px rgba(79,70,229,0.18)',
                }}
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{ elements: { avatarBox: 'w-7 h-7 ring-1 ring-[var(--rule)]' } }}
            />

          </Show>
        </div>

      </div>
    </nav>
  )
}

function NavLink({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center px-3.5 text-[13px] outline-none transition-colors ${
        active
          ? 'text-[var(--brand)] font-semibold'
          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
      {/* 2px gradient bar pinned to the nav bottom — acts as a tab indicator */}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
          style={{ background: 'linear-gradient(90deg, var(--brand), var(--brand-2))' }}
        />
      )}
    </Link>
  )
}
