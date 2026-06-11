import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/components/providers/app-providers'
import { AppLayout } from '@/components/layout/app-layout'
import type { ReactNode } from 'react'
import '@/lib/polyfills/bigint-json'

export const metadata: Metadata = {
  title: 'Aegis — Multichain DeFi Research',
  description: 'AI-powered multichain DeFi research briefs, watchlists, and war-room simulations',
}

const links: { label: string; path: string }[] = [
  { label: 'Home', path: '/' },
  { label: 'Research', path: '/research' },
  { label: 'War Room', path: '/war-room' },
  { label: 'Watchlist', path: '/watchlist' },
]

const utilityLinks: { label: string; path: string }[] = [
  { label: 'Alerts', path: '/alerts' },
  { label: 'Notifications', path: '/settings/notifications' },
]

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}>
        <AppProviders>
          <AppLayout links={links} utilityLinks={utilityLinks}>
            {children}
          </AppLayout>
        </AppProviders>
      </body>
    </html>
  )
}
