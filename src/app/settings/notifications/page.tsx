import React from 'react'
import ChannelManager from '@/components/notifications/channel-manager'
import { BellRing, ShieldAlert } from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'

export const metadata = {
    title: 'Notifications',
}

export default function NotificationsSettingsPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-8 py-6 md:space-y-10 cyber-grid">
            <header className="space-y-4 text-center md:space-y-5">
                <div className="mx-auto flex w-fit items-center gap-2 rounded-xs border border-cyan-500/20 bg-cyan-950/20 px-3 py-1 text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                    <BellRing className="h-3.5 w-3.5" />
                    Notification Settings
                </div>
                <h1 className="text-4xl md:text-5xl font-orbitron font-black tracking-wide text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase text-center">
                    Alerts that feel like part of the Aegis stack
                </h1>
                <p className="mx-auto max-w-2xl text-xs sm:text-sm text-zinc-400 leading-relaxed font-medium">
                    Configure where summaries and alert signals are delivered without leaving the app’s core research flow.
                </p>
            </header>

            <section className="grid gap-4 lg:grid-cols-3">
                <SpotlightCard
                    spotlightColor="rgba(6, 182, 212, 0.03)"
                    borderColor="rgba(6, 182, 212, 0.15)"
                    className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor shadow-2xl lg:col-span-2 text-left"
                >
                    <div className="flex items-center gap-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                        <ShieldAlert className="h-4 w-4 text-cyan-400" />
                        Delivery controls
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400 font-medium font-mono">
                        &gt; Keep notification routing here as a utility setting, separate from primary navigation like Research, War Room, and Watchlist.
                    </p>
                </SpotlightCard>
                <SpotlightCard
                    spotlightColor="rgba(6, 182, 212, 0.03)"
                    borderColor="rgba(6, 182, 212, 0.15)"
                    className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor shadow-2xl text-left"
                >
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">&gt; Scope</p>
                    <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">Wallet-linked alert delivery</p>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-mono">Manage channels tied to your current wallet identity.</p>
                </SpotlightCard>
            </section>

            <section className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs shadow-2xl md:p-6 text-left">
                <ChannelManager />
            </section>
        </div>
    )
}
