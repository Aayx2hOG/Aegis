'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, Menu, X } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { WalletButton } from '@/components/solana/solana-provider'
import { ChainUiSelect } from './chain/chain-ui'

export function AppHeader({
  links = [],
  utilityLinks = [],
}: {
  links: { label: string; path: string }[]
  utilityLinks: { label: string; path: string }[]
}) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  // Merge Alerts into main links list, keep Notifications for the right-side bell icon
  const mainNavLinks = [
    ...links,
    ...utilityLinks.filter((item) => item.label === 'Alerts'),
  ]

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md py-3 px-4 md:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Left Side: Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <Link
            className="flex items-center gap-2 text-sm font-black tracking-tight text-white transition hover:text-zinc-200"
            href="/"
          >
            <div className="w-5.5 h-5.5 rounded-md bg-white text-zinc-950 flex items-center justify-center font-black text-xs select-none">
              Æ
            </div>
            <span className="hidden sm:inline font-bold tracking-tight text-zinc-100">
              Aegis Intelligence
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-6">
              {mainNavLinks.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                      isActive(path)
                        ? 'text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    href={path}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Right Side Controls */}
        <div className="hidden md:flex items-center gap-4">
          {/* Notifications Bell */}
          <Link
            href="/settings/notifications"
            className={`p-2 rounded-lg transition-colors border ${
              isActive('/settings/notifications')
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'border-zinc-800/40 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
            title="Notifications Settings"
          >
            <Bell className="h-4 w-4" />
          </Link>

          <WalletButton />
          <ChainUiSelect />
          <ThemeSelect />
        </div>

        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="border border-zinc-800 bg-zinc-900/40 text-zinc-350 hover:bg-zinc-800 md:hidden"
          onClick={() => setShowMenu(!showMenu)}
        >
          {showMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Drawer */}
      {showMenu && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-50 bg-zinc-950/98 backdrop-blur-md border-t border-zinc-850 p-4 md:hidden flex flex-col justify-between">
          <div className="flex flex-col gap-6">
            <nav className="flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
                Navigation
              </p>
              {mainNavLinks.map(({ label, path }) => (
                <Link
                  key={path}
                  className={`block py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                    isActive(path) ? 'text-white' : 'text-zinc-400 hover:text-zinc-250'
                  }`}
                  href={path}
                  onClick={() => setShowMenu(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="h-[1px] bg-zinc-850" />

            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Identity & Settings
              </p>
              <div className="flex flex-col gap-3">
                <WalletButton />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-450 uppercase font-semibold">Chain:</span>
                  <ChainUiSelect />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-450 uppercase font-semibold">Theme:</span>
                  <ThemeSelect />
                </div>
              </div>
            </div>
          </div>

          <div className="pb-4">
            <Link
              href="/settings/notifications"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
              onClick={() => setShowMenu(false)}
            >
              <Bell className="h-4 w-4" />
              Notifications
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
