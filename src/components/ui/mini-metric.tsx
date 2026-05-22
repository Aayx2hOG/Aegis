import React from 'react'

export default function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-lg bg-zinc-900/70 p-2">
            <p className="text-zinc-500">{label}</p>
            <p className={`font-semibold ${tone ?? 'text-zinc-100'}`}>{value}</p>
        </div>
    )
}
