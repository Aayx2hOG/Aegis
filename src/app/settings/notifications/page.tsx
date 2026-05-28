import React from 'react'
import ChannelManager from '@/components/notifications/channel-manager'
import { BellRing, ShieldAlert } from 'lucide-react'

export const metadata = {
    title: 'Notifications',
}

export default function NotificationsSettingsPage() {
    return (
        <main className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.18),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.12),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-5xl space-y-8 px-4 py-10 md:space-y-10 md:px-6 md:py-14">
                <header className="space-y-4 text-center md:space-y-5">
                    <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
                        <BellRing className="h-3.5 w-3.5" />
                        Notification Settings
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                        Alerts that feel like part of the <span className="text-cyan-200">Aegis</span> stack
                    </h1>
                    <p className="mx-auto max-w-2xl text-zinc-300">
                        Configure where summaries and alert signals are delivered without leaving the app’s core research flow.
                    </p>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm md:col-span-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                            <ShieldAlert className="h-4 w-4" />
                            Delivery controls
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                            Keep notification routing here as a utility setting, separate from primary navigation like Research, War Room, and Watchlist.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-blue-950/20 backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Scope</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-100">Wallet-linked alert delivery</p>
                        <p className="mt-1 text-sm text-zinc-400">Manage channels tied to your current wallet identity.</p>
                    </div>
                </section>

                <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-6">
                    <ChannelManager />
                </section>
            </div>
        </main>
    )
}
