import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/components/app-providers'
import { AppLayout } from '@/components/app-layout'
import type { ReactNode } from 'react'
import '@/lib/polyfills/bigint-json'

export const metadata: Metadata = {
  title: 'Aegis — Solana DeFi Research',
  description: 'AI-powered DeFi research briefs with live Solana data',
}

const links: { label: string; path: string }[] = [
  { label: 'Home', path: '/' },
  { label: 'Research', path: '/research' },
  { label: 'War Room', path: '/war-room' },
  { label: 'Watchlist', path: '/watchlist' },
]

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}>
        <AppProviders>
          <AppLayout links={links}>{children}</AppLayout>
        </AppProviders>
      </body>
    </html>
  )
}
