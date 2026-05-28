"use client"

import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Channel = {
    id: string
    walletAddress: string
    name?: string | null
    type: 'DISCORD' | 'WEBHOOK'
    config: Record<string, unknown>
    enabled: boolean
}

function getGuestWallet() {
    if (typeof window === 'undefined') return null
    const key = 'aegis-alert-guest-id'
    let val = window.localStorage.getItem(key)
    if (!val) {
        val = `guest-${crypto.randomUUID()}`
        window.localStorage.setItem(key, val)
    }
    return val
}

export default function ChannelManager() {
    const wallet = useWallet()
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState(false)

    // Create form
    const [name, setName] = useState('')
    const [type, setType] = useState<'DISCORD' | 'WEBHOOK'>('DISCORD')
    const [url, setUrl] = useState('')
    const [testProtocol, setTestProtocol] = useState('')
    const [testing, setTesting] = useState(false)

    useEffect(() => {
        const g = getGuestWallet()
        setWalletAddress(wallet.publicKey?.toBase58() ?? g)
    }, [wallet.publicKey])

    useEffect(() => {
        if (!walletAddress) return
        void loadChannels()
    }, [walletAddress])

    async function loadChannels() {
        if (!walletAddress) return
        setLoading(true)
        try {
            const res = await fetch(`/api/notifications/channels?walletAddress=${encodeURIComponent(walletAddress)}`)
            if (!res.ok) throw new Error('Failed to load channels')
            const body = await res.json()
            setChannels(body.channels ?? [])
        } catch (err) {
            console.error(err)
            toast.error('Failed to load notification channels')
        } finally {
            setLoading(false)
        }
    }

    async function createChannel() {
        if (!walletAddress) {
            toast.error('Wallet identity not ready')
            return
        }

        try {
            const res = await fetch('/api/notifications/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, type, name: name || undefined, config: { url } }),
            })

            const body = await res.json()
            if (!res.ok) throw new Error(body?.error ?? 'Create failed')
            toast.success('Channel created')
            setName('')
            setUrl('')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error((err instanceof Error) ? err.message : 'Failed to create channel')
        }
    }

    async function toggleEnabled(id: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/notifications/channels/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !enabled }),
            })
            if (!res.ok) throw new Error('Update failed')
            toast.success(enabled ? 'Disabled' : 'Enabled')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error('Failed to update channel')
        }
    }

    async function deleteChannel(id: string) {
        if (!confirm('Delete this notification channel?')) return
        try {
            const res = await fetch(`/api/notifications/channels/${id}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 204) throw new Error('Delete failed')
            toast.success('Channel deleted')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error('Failed to delete channel')
        }
    }

    async function testSend(id: string) {
        try {
            const res = await fetch(`/api/notifications/channels/${id}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test notification from Aegis' }) })
            const body = await res.json()
            if (!res.ok) throw new Error(body?.error ?? 'Test send failed')
            toast.success('Test sent')
        } catch (err) {
            console.error(err)
            toast.error((err instanceof Error) ? err.message : 'Test send failed')
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Notification channels</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 text-sm text-zinc-400">Manage where alert summaries are delivered for your wallet identity.</div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <Input placeholder="Channel name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                        <select className="h-9 rounded-md border px-3" value={type} onChange={(e) => setType(e.target.value as any)}>
                            <option value="DISCORD">Discord webhook</option>
                            <option value="WEBHOOK">Generic webhook</option>
                        </select>
                        <Input placeholder="Webhook URL" value={url} onChange={(e) => setUrl(e.target.value)} />
                    </div>

                    <div className="mt-3">
                        <Button onClick={createChannel}>Create channel</Button>
                    </div>

                    <div className="mt-6 border-t pt-4">
                        <p className="mb-2 text-sm text-zinc-400">End-to-end test: generate an AI summary for a protocol and deliver notifications to your configured channels.</p>
                        <div className="flex gap-2">
                            <Input placeholder="protocol slug (e.g. serum)" value={testProtocol} onChange={(e) => setTestProtocol(e.target.value)} />
                            <Button onClick={async () => {
                                if (!walletAddress) { toast.error('Wallet identity not ready'); return }
                                if (!testProtocol) { toast.error('Enter a protocol slug'); return }
                                setTesting(true)
                                try {
                                    const res = await fetch('/api/test/e2e', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ walletAddress, protocolSlug: testProtocol }),
                                    })
                                    const body = await res.json().catch(() => null)
                                    if (!res.ok) throw new Error(body?.error ?? 'E2E test failed')
                                    toast.success('E2E test enqueued — check your channels')
                                    setTestProtocol('')
                                    if (body?.eventId) {
                                        // show small inline link
                                        const el = document.getElementById('e2e-result')
                                        if (el) el.textContent = `Event ID: ${body.eventId}`
                                    }
                                } catch (err) {
                                    console.error(err)
                                    toast.error((err instanceof Error) ? err.message : 'E2E test failed')
                                } finally {
                                    setTesting(false)
                                }
                            }} disabled={testing}>{testing ? 'Running…' : 'Run E2E test'}</Button>
                        </div>
                        <div id="e2e-result" className="mt-2 text-xs text-zinc-400" />
                    </div>
                </CardContent>
                <CardFooter />
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Configured channels</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-sm text-zinc-400">Loading…</div>
                    ) : channels.length === 0 ? (
                        <div className="text-sm text-zinc-400">No channels configured yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {channels.map((ch) => (
                                <div key={ch.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                    <div>
                                        <div className="font-semibold">{ch.name ?? ch.type}</div>
                                        <div className="text-xs text-zinc-500">{ch.type} • {ch.enabled ? 'enabled' : 'disabled'}</div>
                                        <div className="text-xs text-zinc-400 mt-1 truncate max-w-xl">{String((ch.config as any)?.url ?? '')}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => testSend(ch.id)}>Test</Button>
                                        <Button variant="ghost" onClick={() => toggleEnabled(ch.id, ch.enabled)}>{ch.enabled ? 'Disable' : 'Enable'}</Button>
                                        <Button variant="destructive" onClick={() => deleteChannel(ch.id)}>Delete</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
