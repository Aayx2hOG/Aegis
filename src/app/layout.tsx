import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/components/app-providers'
import { AppLayout } from '@/components/app-layout'
import React from 'react'

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
// Patch BigInt so we can log it using JSON.stringify without any errors
declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}
