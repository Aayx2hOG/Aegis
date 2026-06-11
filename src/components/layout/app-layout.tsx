'use client'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AppHeader } from '@/components/layout/app-header'
import React from 'react'
import { AppFooter } from '@/components/layout/app-footer'
import { ClusterChecker } from '@/components/cluster/cluster-ui'
import { AccountChecker } from '@/components/account/account-ui'

export function AppLayout({
  children,
  links,
  utilityLinks,
}: {
  children: React.ReactNode
  links: { label: string; path: string }[]
  utilityLinks: { label: string; path: string }[]
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="flex min-h-screen flex-col overflow-x-hidden text-zinc-100 selection:bg-zinc-800 selection:text-white bg-[#09090b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.03),transparent)]">
        <AppHeader links={links} utilityLinks={utilityLinks} />
        <main className="flex-grow px-4 pb-8 pt-4 md:px-6 md:pb-10 md:pt-5 z-10 relative">
          <ClusterChecker>
            <AccountChecker />
          </ClusterChecker>
          {children}
        </main>
        <AppFooter />
      </div>
      <Toaster />
    </ThemeProvider>
  )
}
