'use client'

import { Toaster } from '@/components/ui/sonner'
import { AppHeader } from '@/components/layout/app-header'
import React, { Suspense } from 'react'
import { AppFooter } from '@/components/layout/app-footer'
import { ClusterChecker } from '@/components/cluster/cluster-ui'
import { AccountChecker } from '@/components/account/account-ui'
import { MarketBackdrop } from '@/components/layout/market-backdrop'

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
    <>
      <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-zinc-100 selection:bg-cyan-300 selection:text-zinc-950">
        <div className="app-atmosphere pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(6,182,212,0.045),transparent_22%,transparent_78%,rgba(16,185,129,0.035)),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_32%)]" />
        <MarketBackdrop />
        <Suspense fallback={<div className="h-[60px] bg-zinc-950 border-b border-cyan-500/10" />}>
          <AppHeader links={links} utilityLinks={utilityLinks} />
        </Suspense>
        <main className="relative z-10 flex-grow px-4 pb-8 pt-4 md:px-6 md:pb-10 md:pt-5">
          <ClusterChecker />
          <AccountChecker />
          {children}
        </main>
        <AppFooter />
      </div>
      <Toaster />
    </>
  )
}
