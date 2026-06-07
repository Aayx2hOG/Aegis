import React from 'react'

export function AppFooter() {
  return (
    <footer className="bg-[#09090b]/90 px-4 py-4 text-xs text-zinc-500 border-t border-zinc-900/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="text-center sm:text-left">
          Built by{' '}
          <a
            className="font-semibold text-zinc-300 transition hover:text-white"
            href=""
            target="_blank"
            rel="noopener noreferrer"
          >
            Aayush
          </a>
        </div>
      </div>
    </footer>
  )
}
