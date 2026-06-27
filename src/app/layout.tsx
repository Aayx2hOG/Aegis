import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/components/providers/app-providers'
import { AppLayout } from '@/components/layout/app-layout'
import type { ReactNode } from 'react'
import '@/lib/polyfills/bigint-json'

export const metadata: Metadata = {
  title: 'Aegis — DeFi Risk Monitoring',
  description: 'Rule-based DeFi protocol monitoring with watchlists, alerts, and optional advanced tools',
}

const links: { label: string; path: string }[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Research', path: '/research' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'Opportunities', path: '/research/compare' },
]

const utilityLinks: { label: string; path: string }[] = [{ label: 'Notifications', path: '/alerts?tab=channels' }]

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
