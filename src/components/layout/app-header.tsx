'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { useAtom } from 'jotai'
import { beginnerModeAtom } from '@/lib/store/research-store'
import { Button } from '@/components/ui/button'
import { Bell, Menu, X } from 'lucide-react'
import { ThemeSelect } from '@/components/ui/theme-select'
import { WalletButton } from '@/components/solana/solana-provider'
import { ChainUiSelect } from '@/components/chain/chain-ui'

export function AppHeader({
  links = [],
  utilityLinks = [],
}: {
  links: { label: string; path: string }[]
  utilityLinks: { label: string; path: string }[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showMenu, setShowMenu] = useState(false)
  const [beginnerMode, setBeginnerMode] = useAtom(beginnerModeAtom)

  const activeTab = searchParams.get('tab')

  // Merge Alerts into main links list, keep Notifications for the right-side bell icon
  const mainNavLinks = [...links, ...utilityLinks.filter((item) => item.label === 'Alerts')]

  function isLinkActive(path: string) {
    if (path === '/alerts') {
      return pathname === '/alerts' && activeTab !== 'channels'
    }
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  const isBellActive = pathname === '/settings/notifications' || (pathname === '/alerts' && activeTab === 'channels')

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-cyan-500/10 bg-zinc-950/85 backdrop-blur-md py-3.5 px-4 md:px-8 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Left Side: Logo & Main Nav */}
          <div className="flex items-center gap-4 lg:gap-6 xl:gap-8">
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
            <span className="hidden xl:flex items-center gap-1.5 rounded-xs border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 text-[9px] font-orbitron font-bold uppercase tracking-widest text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.08)]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              GRID ONLINE
            </span>

           {/* Desktop Nav Links */}
            <nav className="hidden lg:block">
              <ul className="flex items-center gap-3 xl:gap-6">
                {mainNavLinks.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`relative text-[11px] font-orbitron font-bold uppercase tracking-wider transition-colors duration-200 py-1.5 whitespace-nowrap ${isLinkActive(path) ? 'text-white' : 'text-zinc-400 hover:text-cyan-400'
                        }`}
                      href={path}
                    >
                      {label}
                      <span
                        className={`absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-all duration-300 origin-center ${isLinkActive(path) ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50 pointer-events-none'
                          }`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Right Side Controls */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4 ml-4 lg:ml-8">
            {/* Beginner Mode Toggle */}
            <button
              onClick={() => setBeginnerMode(!beginnerMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 mr-1 rounded-xs border transition-all duration-300 text-[9px] font-orbitron font-bold uppercase tracking-wider cursor-pointer ${beginnerMode
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)] animate-pulse'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              title="Toggle Beginner / Pro Mode"
            >
              <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${beginnerMode ? 'bg-cyan-400' : 'bg-zinc-700'}`} />
              <span>{beginnerMode ? 'Beginner Mode' : 'Pro Mode'}</span>
            </button>

            <div className="border-l border-zinc-800 h-5 my-auto mx-1" />

            <WalletButton />
            <ChainUiSelect />
            <ThemeSelect />
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400 lg:hidden rounded-xs"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {showMenu && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-[100] bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 p-4 lg:hidden flex flex-col gap-6 overflow-y-auto">
          <div className="flex flex-col gap-6 shrink-0">
            <nav className="flex flex-col gap-3">
              <p className="text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
                Navigation System
              </p>
              {mainNavLinks.map(({ label, path }) => (
                <Link
                  key={path}
                  className={`block py-2 text-sm font-orbitron font-semibold uppercase tracking-widest transition-colors ${isLinkActive(path) ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'
                    }`}
                  href={path}
                  onClick={() => setShowMenu(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="h-[1px] bg-zinc-800" />

            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-500">
                Identity & Settings
              </p>
              <div className="flex flex-col gap-3">
                <WalletButton />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">Workspace:</span>
                  <button
                    onClick={() => setBeginnerMode(!beginnerMode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border transition-all duration-300 text-[10px] font-orbitron font-bold uppercase tracking-wider ${beginnerMode
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                      }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${beginnerMode ? 'bg-cyan-400' : 'bg-zinc-700'}`} />
                    <span>{beginnerMode ? 'Beginner' : 'Pro'}</span>
                  </button>
                </div>
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


          <div className="pb-4 mt-auto shrink-0">
            <Link
              href="/alerts?tab=channels"
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xs border text-sm font-semibold transition-colors ${
                isBellActive
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900 hover:text-cyan-400'
              }`}
              onClick={() => setShowMenu(false)}
            >
              <Bell className="h-4 w-4" />
              Notifications Configuration
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
