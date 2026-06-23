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
      <header className="app-header sticky top-0 z-[100] border-b border-white/10 bg-zinc-950/82 px-4 py-3 backdrop-blur-xl shadow-lg shadow-black/25 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-6 xl:gap-8">
            <Link
              className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white transition hover:text-zinc-200"
              href="/"
            >
              <div className="flex h-8 w-8 select-none items-center justify-center rounded-md border border-cyan-200/40 bg-cyan-300 text-sm font-black text-zinc-950 shadow-lg shadow-cyan-950/25">
                Æ
              </div>
              <div className="flex flex-col">
                <span className="hidden text-sm font-bold tracking-tight text-zinc-100 sm:inline">
                  Aegis
                </span>
                <span className="hidden text-[11px] font-medium text-zinc-500 sm:inline">
                  DeFi intelligence
                </span>
              </div>
            </Link>

            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 xl:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live data
            </span>

            <nav className="hidden lg:block">
              <ul className="flex items-center gap-1.5">
                {mainNavLinks.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isLinkActive(path)
                          ? 'bg-white/[0.08] text-white shadow-inner shadow-white/[0.02]'
                          : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                      }`}
                      href={path}
                    >
                      {label}
                      {isLinkActive(path) && (
                        <span className="absolute inset-x-3 -bottom-[13px] h-px bg-cyan-300/70 shadow-[0_0_8px_rgba(103,232,249,0.45)]" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="ml-4 hidden items-center gap-3 lg:flex xl:gap-4">
            <button
              onClick={() => setBeginnerMode(!beginnerMode)}
              className={`mr-1 flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                beginnerMode
                  ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
              }`}
              title="Toggle Beginner / Pro Mode"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  beginnerMode ? 'bg-cyan-200' : 'bg-zinc-600'
                }`}
              />
              <span>{beginnerMode ? 'Beginner' : 'Pro'}</span>
            </button>

            <div className="mx-1 my-auto h-5 border-l border-white/10" />

            <WalletButton />
            <ChainUiSelect />
            <ThemeSelect />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white lg:hidden"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {showMenu && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-[100] flex flex-col gap-6 overflow-y-auto border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-6 shrink-0">
            <nav className="flex flex-col gap-3">
              <p className="mb-1 text-xs font-semibold text-zinc-500">
                Navigation
              </p>
              {mainNavLinks.map(({ label, path }) => (
                <Link
                  key={path}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    isLinkActive(path) ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
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
              <p className="text-xs font-semibold text-zinc-500">
                Identity & Settings
              </p>
              <div className="flex flex-col gap-3">
                <WalletButton />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">Workspace:</span>
                  <button
                    onClick={() => setBeginnerMode(!beginnerMode)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${
                      beginnerMode ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-zinc-400'
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
              className={`flex w-full items-center justify-center gap-2 rounded-md border py-3 text-sm font-semibold transition-colors ${
                isBellActive
                  ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white'
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
