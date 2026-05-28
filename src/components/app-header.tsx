'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, ChevronDown, Menu, X } from 'lucide-react'
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
  const [showUtilities, setShowUtilities] = useState(false)
  const hasActiveUtility = utilityLinks.some(({ path }) => isActive(path))


  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 bg-[#050910]/90 px-4 py-3 text-zinc-300 shadow-[0_2px_12px_rgba(0,0,0,0.18)] backdrop-blur-md">

      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-baseline gap-4">
          <Link className="text-lg font-black tracking-tight text-zinc-100 transition hover:text-cyan-200" href="/">
            <span>Aegis Intelligence</span>
          </Link>
          <div className="hidden md:flex items-center">
            <ul className="flex flex-nowrap items-center gap-4">
              {links.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`text-sm font-semibold uppercase tracking-wide transition ${isActive(path)
                      ? 'text-cyan-200'
                      : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    href={path}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-wide transition ${showUtilities || hasActiveUtility
                    ? 'text-cyan-200'
                    : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  onClick={() => setShowUtilities(!showUtilities)}
                >
                  Utilities
                  <ChevronDown className="h-4 w-4" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 md:hidden"
          onClick={() => {
            setShowUtilities(false)
            setShowMenu(!showMenu)
          }}
        >
          {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        <div className="hidden md:flex items-center gap-4">
          <div className="relative">
            {showUtilities && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-white/10 bg-[#060b13]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Tools</p>
                <div className="flex flex-col gap-1">
                  {utilityLinks.map(({ label, path }) => (
                    <Link
                      key={path}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive(path)
                        ? 'bg-cyan-400/10 text-cyan-200'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                        }`}
                      href={path}
                      onClick={() => setShowUtilities(false)}
                    >
                      <Bell className="h-4 w-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <WalletButton />
          <ChainUiSelect />
          <ThemeSelect />
        </div>

        {showMenu && (
          <div className="fixed inset-x-0 bottom-0 top-[64px] bg-[#060b13]/96 backdrop-blur-sm md:hidden">
            <div className="flex flex-col gap-4 p-4">
              <ul className="flex flex-col gap-4">
                {links.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`block py-2 text-base font-semibold uppercase tracking-wide transition ${isActive(path) ? 'text-cyan-200' : 'text-zinc-300 hover:text-zinc-100'
                        }`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Utilities</p>
                <div className="flex flex-col gap-2">
                  {utilityLinks.map(({ label, path }) => (
                    <Link
                      key={path}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${isActive(path)
                        ? 'bg-cyan-400/10 text-cyan-200'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                        }`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      <Bell className="h-4 w-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <WalletButton />
                <ChainUiSelect />
                <ThemeSelect />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
