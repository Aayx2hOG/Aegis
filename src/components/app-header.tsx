'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'
import { WalletButton } from '@/components/solana/solana-provider'

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 bg-[#050910]/80 px-4 py-3 text-zinc-300 shadow-[0_6px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-baseline gap-4">
          <Link className="text-lg font-black tracking-tight text-zinc-100 transition hover:text-cyan-200" href="/">
            <span>Aegis Intelligence</span>
          </Link>
          <div className="hidden md:flex items-center">
            <ul className="flex gap-4 flex-nowrap items-center">
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
            </ul>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 md:hidden"
          onClick={() => setShowMenu(!showMenu)}
        >
          {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        <div className="hidden md:flex items-center gap-4">
          <WalletButton />
          <ClusterUiSelect />
          <ThemeSelect />
        </div>

        {showMenu && (
          <div className="fixed inset-x-0 bottom-0 top-[64px] bg-[#060b13]/95 backdrop-blur md:hidden">
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
              <div className="flex flex-col gap-4">
                <WalletButton />
                <ClusterUiSelect />
                <ThemeSelect />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
