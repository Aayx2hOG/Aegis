'use client'

import Link from 'next/link'
import { BellRing, FlaskConical, Search, ShieldCheck, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'

const WORKFLOW_STEPS = [
  {
    title: 'Research',
    body: 'Generate a live protocol brief before adding anything to your watchlist.',
    href: '/research',
    icon: Search,
  },
  {
    title: 'Watch',
    body: 'Track the protocols you care about across the active chain catalog.',
    href: '/watchlist',
    icon: Star,
  },
  {
    title: 'Alert',
    body: 'Create rules for TVL, price, and movement thresholds.',
    href: '/alerts',
    icon: ShieldCheck,
  },
  {
    title: 'Notify',
    body: 'Send triggered alert summaries to Discord or Telegram.',
    href: '/alerts?tab=channels',
    icon: BellRing,
  },
  {
    title: 'Simulate',
    body: 'Stress-test positions before making real decisions.',
    href: '/war-room',
    icon: FlaskConical,
  },
]

export function PrimaryWorkflow({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-lg border border-cyan-500/10 bg-zinc-950/50 p-4 text-left shadow-xl md:p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-orbitron font-bold uppercase tracking-[0.22em] text-cyan-400">
            Primary workflow
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Research, monitor, notify, then rehearse the response.
          </h2>
        </div>
        <Button asChild className="aegis-button-primary h-9 w-full text-xs md:w-auto">
          <Link href="/alerts">Create alert</Link>
        </Button>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <Link
              key={step.title}
              href={step.href}
              className="group rounded-md border border-white/10 bg-white/[0.025] p-3 transition-colors hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/15 bg-cyan-500/10 text-cyan-300">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="font-mono text-[10px] font-bold text-zinc-600">0{index + 1}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-white group-hover:text-cyan-100">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{step.body}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
