import React from 'react'
import ChannelManager from '@/components/notifications/channel-manager'
import { BellRing, ShieldAlert } from 'lucide-react'

export const metadata = {
    title: 'Notifications',
}

export default function NotificationsSettingsPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-8 py-6 md:space-y-10">
            <header className="space-y-4 text-center md:space-y-5">
                <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    <BellRing className="h-3.5 w-3.5" />
                    Notification Settings
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                    Alerts that feel like part of the Aegis stack
                </h1>
                <p className="mx-auto max-w-2xl text-sm text-zinc-400 leading-relaxed font-medium">
                    Configure where summaries and alert signals are delivered without leaving the app’s core research flow.
                </p>
            </header>

            <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 shadow-xl backdrop-blur-md lg:col-span-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldAlert className="h-4 w-4 text-zinc-400" />
                        Delivery controls
                    </div>
                    <p className="mt-2 text-xs leading-6 text-zinc-400 font-medium">
                        Keep notification routing here as a utility setting, separate from primary navigation like Research, War Room, and Watchlist.
                    </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 shadow-xl backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Scope</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-150">Wallet-linked alert delivery</p>
                    <p className="mt-1.5 text-xs text-zinc-450 leading-relaxed font-medium">Manage channels tied to your current wallet identity.</p>
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 backdrop-blur-md md:p-6">
                <ChannelManager />
            </section>
        </div>
    )
}
