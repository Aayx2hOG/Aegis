'use client'

import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import { AppHeader } from '@/components/app-header'
import React from 'react'
import { AppFooter } from '@/components/app-footer'
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
      <div className="flex min-h-screen flex-col overflow-x-hidden text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.18),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.12),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
        {/* Background Decor Blobs & Cyber Grid */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_65%,transparent_100%)]" />
        </div>

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
