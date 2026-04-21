import type { Metadata } from 'next'
import { ClerkProvider, SignInButton, Show, UserButton } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { TanStackQueryProvider } from '@/components/providers/tanstack-query-provider'
import { Geist, Geist_Mono } from 'next/font/google' 
import { Logo } from '@/components/logo'
import Link from 'next/link'
import './globals.css'
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CodePulse — Repository Health Monitor',
  description: 'Monitor your codebase health on every push. Complexity, vulnerabilities, dead code, coverage, and drift — all in one dashboard.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className="dark">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen selection:bg-blue-500/30`}>
          {/* Ambient gradient background */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/[0.07] blur-[120px] rounded-full" />
            <div className="absolute top-[40%] right-0 w-[500px] h-[400px] bg-indigo-500/[0.04] blur-[100px] rounded-full" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a12_1px,transparent_1px),linear-gradient(to_bottom,#27272a12_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
          </div>

          <nav className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              
              <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                <Logo className="w-7 h-7" />
                <span className="font-medium text-lg tracking-tight text-white mb-0.5">
                  Code<span className="text-blue-500 font-semibold">Pulse</span>
                </span>
              </Link>

              <div className="flex items-center gap-4">
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-md px-4 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
                      Sign in
                    </button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: 'w-8 h-8',
                      },
                    }}
                  />
                </Show>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TanStackQueryProvider> 
              {children}
            </TanStackQueryProvider>
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
}
