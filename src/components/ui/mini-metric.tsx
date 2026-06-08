import React from 'react'

export default function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-2 font-mono text-left">
            <p className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider">{label}</p>
            <p className={`text-xs font-bold mt-0.5 tracking-wide ${tone ?? 'text-zinc-350'}`}>{value}</p>
        </div>
    )
}
