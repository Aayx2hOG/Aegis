import React from 'react'

export function AppFooter() {
  return (
    <footer className="bg-[#050910]/90 px-4 py-4 text-center text-xs text-zinc-500">
      Built on Solana with{' '}
      <a
        className="font-semibold text-zinc-300 transition hover:text-cyan-200"
        href="https://github.com/solana-developers/create-solana-dapp"
        target="_blank"
        rel="noopener noreferrer"
      >
        create-solana-dapp
      </a>
    </footer>
  )
}
