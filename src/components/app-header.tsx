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
    <header className="sticky top-0 z-50 border-b border-cyan-500/10 bg-zinc-950/85 backdrop-blur-md py-3 px-4 md:px-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Left Side: Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <Link
            className="flex items-center gap-2.5 text-sm font-black tracking-tight text-white transition hover:text-zinc-200"
            href="/"
          >
            <div className="w-6 h-6 rounded-xs bg-cyan-500 text-zinc-950 flex items-center justify-center font-orbitron font-black text-sm select-none shadow-[0_0_10px_rgba(6,182,212,0.4)]">
              Æ
            </div>
            <div className="flex flex-col">
              <span className="hidden sm:inline font-orbitron font-black tracking-wide text-zinc-100 text-xs">
                AEGIS INTELLIGENCE
              </span>
              <span className="hidden sm:inline text-[9px] text-cyan-400 font-mono tracking-wider font-semibold">
                DEFI MONITOR
              </span>
            </div>
          </Link>

          {/* Pulsing Status Dot */}
          <span className="hidden lg:flex items-center gap-1.5 rounded-xs border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 text-[9px] font-orbitron font-bold uppercase tracking-widest text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.08)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            GRID ONLINE
          </span>

          {/* Desktop Nav Links */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-7">
              {mainNavLinks.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`relative text-xs font-orbitron font-bold uppercase tracking-widest transition-colors duration-200 py-1.5 ${
                      isActive(path)
                        ? 'text-white'
                        : 'text-zinc-450 hover:text-cyan-400'
                    }`}
                    href={path}
                  >
                    {label}
                    {isActive(path) && (
                      <span className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                    )}
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
            className={`p-2 rounded-xs transition-all border ${
              isActive('/settings/notifications')
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'border-zinc-800 text-zinc-400 hover:bg-zinc-900/60 hover:text-cyan-400 hover:border-cyan-500/20'
            }`}
            title="Notifications Settings"
          >
            <Bell className="h-4 w-4" />
          </Link>

          <div className="border-l border-zinc-800 h-5 my-auto mx-1" />

          <WalletButton />
          <ChainUiSelect />
          <ThemeSelect />
        </div>

        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-850 hover:text-cyan-400 md:hidden rounded-xs"
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
              <p className="text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-550 mb-1">
                Navigation System
              </p>
              {mainNavLinks.map(({ label, path }) => (
                <Link
                  key={path}
                  className={`block py-2 text-sm font-orbitron font-semibold uppercase tracking-widest transition-colors ${
                    isActive(path) ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'
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
              <p className="text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-550">
                Identity & Settings
              </p>
              <div className="flex flex-col gap-3">
                <WalletButton />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">Chain:</span>
                  <ChainUiSelect />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">Theme:</span>
                  <ThemeSelect />
                </div>
              </div>
            </div>
          </div>

          <div className="pb-4">
            <Link
              href="/settings/notifications"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xs border border-zinc-800 bg-zinc-900/40 text-sm font-semibold text-zinc-350 hover:bg-zinc-900 hover:text-cyan-400 transition-colors"
              onClick={() => setShowMenu(false)}
            >
              <Bell className="h-4 w-4" />
              Notifications Configuration
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
