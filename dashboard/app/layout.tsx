import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { TanStackQueryProvider } from '@/components/providers/tanstack-query-provider'
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google'
import { Nav } from '@/components/Nav'
import {CommandPalette} from '@/components/CommandPalette'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// Bricolage Grotesque — distinctive modern grotesque for display headlines.
// Variable axis lets us tune weight and width per heading.
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'CodePulse — Repository Health Monitor',
  description:
    'Monitor your codebase health on every push. Complexity, vulnerabilities, dead code, coverage, and drift — all in one dashboard.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
         <body className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased min-h-screen flex flex-col`}>                                                 
            <TanStackQueryProvider>                                                                                                                                                     
              <Nav />
              <main className="flex-1 flex flex-col w-full">{children}</main>                                                                                                           
              <CommandPalette />                            
            </TanStackQueryProvider>
          </body>
      </html>
    </ClerkProvider>
  )
}
