'use client'

import { useState } from 'react'
import { BookOpen, X, HelpCircle } from 'lucide-react'

export const DEFI_GLOSSARY = {
  TVL: 'Total Value Locked: The total amount of money deposited by users inside this protocol. High TVL means high trust and deeper liquidity.',
  LTV: 'Loan-to-Value: The ratio of borrowed funds compared to your collateral. If LTV gets too high, your safety deposit can be automatically sold (liquidated).',
  APY: 'Annual Percentage Yield: The total return you would earn on an investment in one year, including the compound interest.',
  'Risk State':
    'Risk Status: Calculated by tracking rapid drops in value. "Watch" indicates moderate volatility; "Critical" means massive liquidity flight.',
  Slippage:
    'Slippage: The difference between the price you expect for a trade and the price you actually get due to market movement during execution.',
  'Impermanent Loss':
    'Impermanent Loss: A temporary drop in value that occurs when you provide liquidity to a pool, and the price ratio of your tokens changes compared to when you put them in.',
  'Liquidity Score':
    'Liquidity Score: A rating (1-100) indicating how easily assets can be swapped without causing extreme price changes.',
  Volatility:
    "Volatility: A measure of how much and how fast an asset's price fluctuates. High volatility means higher risk but potential for higher return.",
  'Oracle Delay':
    'Oracle Delay: A delay in the network feed that updates prices. A long delay can cause protocols to use stale prices, risking exploits.',
  'Sequencer Downtime':
    'Sequencer Downtime: When the central controller of a Layer-2 network stops working, temporarily freezing all transactions and trades.',
  'Bridge Outage':
    'Bridge Outage: When the connection between two blockchains breaks, locking your funds on the network they are currently on.',
  'Market Shock':
    'Market Shock: An extreme, sudden drop in asset prices across the entire crypto market (e.g. -20% or more).',
} as const

export type GlossaryTerm = keyof typeof DEFI_GLOSSARY

export function DeFiTooltip({ term, children }: { term: GlossaryTerm; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const definition = DEFI_GLOSSARY[term]

  return (
    <span
      className="relative inline-flex items-center gap-0.5 group cursor-help border-b border-dashed border-cyan-500/40 pb-0.5"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <HelpCircle className="h-2.5 w-2.5 text-cyan-500/60 inline" />
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-md bg-zinc-950/98 border border-cyan-500/40 text-zinc-300 font-mono text-[9.5px] leading-relaxed shadow-[0_4px_25px_rgba(6,182,212,0.3)] backdrop-blur-md z-[100] pointer-events-none select-none">
          <span className="block font-orbitron font-bold text-cyan-400 uppercase mb-1 tracking-wider">{term}</span>
          {definition}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950" />
        </span>
      )}
    </span>
  )
}

export function BeginnerOnboardingCard({
  title,
  steps,
  onClose,
}: {
  title: string
  steps: string[]
  onClose?: () => void
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-md border border-cyan-500/20 bg-zinc-950/70 p-5 shadow-[0_0_15px_rgba(6,182,212,0.05)] backdrop-blur-lg text-left mb-6">
      <div className="absolute top-0 left-0 h-full w-[3px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="p-2 rounded bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-orbitron font-bold text-xs uppercase tracking-wide text-zinc-200">{title}</h4>
            <div className="mt-2.5 space-y-2 text-[10.5px] leading-relaxed text-zinc-400 font-mono">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-cyan-400 font-bold shrink-0">&gt;</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            if (onClose) onClose()
          }}
          className="text-zinc-550 hover:text-zinc-350 transition-colors p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
