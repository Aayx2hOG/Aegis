import { SpotlightCard } from '@/components/ui/spotlight-card'

type MetricCardProps = {
  label: string
  value: string
  helper: string
  accent?: string
}

export function MetricCard({ label, value, helper, accent }: MetricCardProps) {
  return (
    <SpotlightCard
      spotlightColor="rgba(6, 182, 212, 0.03)"
      borderColor="rgba(6, 182, 212, 0.15)"
      className="border-cyan-500/10 bg-zinc-950/45 p-5 rounded-xs corner-decor text-left"
    >
      <p className="text-[9px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`text-2xl font-orbitron font-black mt-3 ${accent ?? 'text-white'}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-450 font-medium leading-relaxed">{helper}</p>
    </SpotlightCard>
  )
}
