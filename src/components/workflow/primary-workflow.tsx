'use client'

import Link from 'next/link'
import { Activity, BarChart3, BellRing, FlaskConical, Search, ShieldCheck, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'

const WORKFLOW_STEPS = [
  {
    title: 'Research',
    body: 'Check live protocol metrics before tracking a position.',
    href: '/research',
    icon: Search,
  },
  {
    title: 'Save',
    body: 'Add important protocols to your monitoring list from Research.',
    href: '/research',
    icon: Star,
  },
  {
    title: 'Alerts',
    body: 'Create rule-based checks for TVL, price, and movement thresholds.',
    href: '/alerts',
    icon: ShieldCheck,
  },
  {
    title: 'Simulate',
    body: 'Stress-test portfolio impact when an alert or protocol deserves deeper review.',
    href: '/war-room',
    icon: FlaskConical,
  },
]

const OPTIONAL_TOOLS = [
  {
    title: 'Notifications',
    body: 'Send triggered alert events to Discord or Telegram.',
    href: '/alerts?tab=channels',
    icon: BellRing,
  },
  {
    title: 'Saved protocols',
    body: 'Open the full saved-protocol workspace when you need bulk review tools.',
    href: '/watchlist',
    icon: Activity,
  },
  {
    title: 'Compare protocols',
    body: 'Use side-by-side research only when one protocol brief is not enough.',
    href: '/research/compare',
    icon: BarChart3,
  },
]

export function PrimaryWorkflow({ compact = false }: { compact?: boolean }) {
  return (
    <section className="finance-surface p-4 text-left md:p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="finance-label text-cyan-300">Core workflow</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Research, save, alert, then simulate what needs deeper review.
          </h2>
        </div>
        <Button asChild className="aegis-button-primary h-9 w-full text-xs md:w-auto">
          <Link href="/research">Start with Research</Link>
        </Button>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <Link
              key={step.title}
              href={step.href}
              className="group relative rounded-md border border-white/10 bg-zinc-950/55 p-3 transition-colors hover:border-cyan-300/25 hover:bg-zinc-950/80"
            >
              {index < WORKFLOW_STEPS.length - 1 && (
                <span className="pointer-events-none absolute -right-3 top-6 hidden h-px w-3 bg-white/10 lg:block" />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/15 bg-cyan-500/10 text-cyan-300">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-500">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-white group-hover:text-cyan-100">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{step.body}</p>
            </Link>
          )
        })}
      </div>

      {!compact && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="finance-label text-zinc-500">Optional tools</p>
              <p className="mt-1 text-sm text-zinc-400">
                Advanced features stay available without blocking the main flow.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {OPTIONAL_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="group rounded-md border border-white/10 bg-zinc-950/35 p-3 transition-colors hover:border-cyan-300/20 hover:bg-zinc-950/65"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-400">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                      Optional
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-zinc-100 group-hover:text-cyan-100">{tool.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tool.body}</p>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
