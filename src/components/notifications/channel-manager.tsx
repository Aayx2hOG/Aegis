"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
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

function maskWebhookUrl(rawUrl: unknown) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return 'URL not configured'

    try {
        const parsed = new URL(rawUrl)
        const tail = parsed.pathname.split('/').filter(Boolean).at(-1)?.slice(-4)
        return `${parsed.origin}/...${tail ? tail : ''}`
    } catch {
        return 'Configured URL'
    }
}

function isChannelType(value: string): value is Channel['type'] {
    return value === 'DISCORD' || value === 'WEBHOOK'
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
    const [method, setMethod] = useState<'POST' | 'PUT' | 'PATCH'>('POST')
    const [headersJson, setHeadersJson] = useState('')
    const [secret, setSecret] = useState('')
    const [signatureHeader, setSignatureHeader] = useState('x-aegis-signature')
    const [testProtocol, setTestProtocol] = useState('')
    const [testChannelId, setTestChannelId] = useState('')
    const [testing, setTesting] = useState(false)
    const testingRef = useRef(false)

    useEffect(() => {
        const g = getGuestWallet()
        setWalletAddress(wallet.publicKey?.toBase58() ?? g)
    }, [wallet.publicKey])

    const loadChannels = useCallback(async () => {
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
    }, [walletAddress])

    useEffect(() => {
        if (!walletAddress) return
        void loadChannels()
    }, [walletAddress, loadChannels])

    useEffect(() => {
        if (testChannelId && !channels.some((channel) => channel.id === testChannelId && channel.enabled)) {
            setTestChannelId('')
        }
    }, [channels, testChannelId])

    async function createChannel() {
        if (!walletAddress) {
            toast.error('Wallet identity not ready')
            return
        }

        try {
            let headers: Record<string, string> | undefined
            if (type === 'WEBHOOK' && headersJson.trim()) {
                try {
                    const parsed = JSON.parse(headersJson)
                    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Headers must be an object')
                    headers = {}
                    for (const [k, v] of Object.entries(parsed)) {
                        if (typeof v !== 'string') throw new Error('Header values must be strings')
                        headers[k] = v
                    }
                } catch (err) {
                    toast.error((err instanceof Error) ? err.message : 'Invalid headers JSON')
                    return
                }
            }

            const res = await fetch('/api/notifications/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, type, name: name || undefined, config: { url, method: type === 'WEBHOOK' ? method : undefined, headers: type === 'WEBHOOK' ? headers : undefined, secret: type === 'WEBHOOK' ? (secret || undefined) : undefined, signatureHeader: type === 'WEBHOOK' ? (signatureHeader || undefined) : undefined } }),
            })

            const body = await res.json()
            if (!res.ok) throw new Error(body?.error ?? 'Create failed')
            toast.success('Channel created')
            setName('')
            setUrl('')
            setHeadersJson('')
            setMethod('POST')
            setSecret('')
            setSignatureHeader('x-aegis-signature')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error((err instanceof Error) ? err.message : 'Failed to create channel')
        }
    }

    async function toggleEnabled(id: string, enabled: boolean) {
        if (!walletAddress) {
            toast.error('Wallet identity not ready')
            return
        }

        try {
            const res = await fetch(`/api/notifications/channels/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, enabled: !enabled }),
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
        if (!walletAddress) {
            toast.error('Wallet identity not ready')
            return
        }

        if (!confirm('Delete this notification channel?')) return
        try {
            const res = await fetch(`/api/notifications/channels/${id}?walletAddress=${encodeURIComponent(walletAddress)}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 204) throw new Error('Delete failed')
            toast.success('Channel deleted')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error('Failed to delete channel')
        }
    }

    async function testSend(id: string) {
        if (!walletAddress) {
            toast.error('Wallet identity not ready')
            return
        }

        try {
            const res = await fetch(`/api/notifications/channels/${id}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress, message: 'Test notification from Aegis' }) })
            const body = await res.json()
            if (!res.ok) throw new Error(body?.error ?? 'Test send failed')
            toast.success('Test sent')
        } catch (err) {
            console.error(err)
            toast.error((err instanceof Error) ? err.message : 'Test send failed')
        }
    }

    async function editChannel(id: string) {
        if (!walletAddress) { toast.error('Wallet identity not ready'); return }
        const ch = channels.find((c) => c.id === id)
        if (!ch) { toast.error('Channel not found'); return }

        const newUrl = prompt('Webhook URL', String(ch.config?.url ?? ''))
        if (newUrl == null) return

        let newMethod: string | undefined
        let newHeadersJson: string | undefined
        let newSecret: string | undefined
        let newSignatureHeader: string | undefined

        if (ch.type === 'WEBHOOK') {
            newMethod = prompt('HTTP method (POST/PUT/PATCH)', String(ch.config?.method ?? 'POST')) ?? undefined
            newHeadersJson = prompt('Headers JSON (e.g. {"Authorization":"Bearer x"})', JSON.stringify(ch.config?.headers ?? {})) ?? undefined
            newSecret = prompt('Secret (leave blank to unset)', String(ch.config?.secret ?? '')) ?? undefined
            newSignatureHeader = prompt('Signature header (leave blank for default)', String(ch.config?.signatureHeader ?? 'x-aegis-signature')) ?? undefined
        }

        let parsedHeaders: Record<string, string> | undefined
        if (newHeadersJson && newHeadersJson.trim()) {
            try {
                const parsed = JSON.parse(newHeadersJson)
                if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Headers must be an object')
                parsedHeaders = {}
                for (const [k, v] of Object.entries(parsed)) {
                    if (typeof v !== 'string') throw new Error('Header values must be strings')
                    parsedHeaders[k] = v
                }
            } catch (err) {
                toast.error((err instanceof Error) ? err.message : 'Invalid headers JSON')
                return
            }
        }

        try {
            const res = await fetch(`/api/notifications/channels/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, config: { url: newUrl, method: newMethod, headers: parsedHeaders, secret: newSecret || undefined, signatureHeader: newSignatureHeader || undefined } }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? 'Update failed')
            }
            toast.success('Channel updated')
            await loadChannels()
        } catch (err) {
            console.error(err)
            toast.error((err instanceof Error) ? err.message : 'Failed to update channel')
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

                    <div className="grid gap-3 lg:grid-cols-3">
                        <Input placeholder="Channel name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                        <select className="h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-100" value={type} onChange={(e) => {
                            if (isChannelType(e.target.value)) setType(e.target.value)
                        }}>
                            <option value="DISCORD">Discord webhook</option>
                            <option value="WEBHOOK">Generic webhook</option>
                        </select>
                        <Input placeholder="Webhook URL" value={url} onChange={(e) => setUrl(e.target.value)} />
                    </div>

                    {type === 'WEBHOOK' && (
                        <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            <select className="h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-100" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                            <Input placeholder='Headers JSON (e.g. {"Authorization":"Bearer x"})' value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} />
                            <div />
                        </div>
                    )}

                    {type === 'WEBHOOK' && (
                        <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            <Input placeholder="Secret (optional)" value={secret} onChange={(e) => setSecret(e.target.value)} />
                            <Input placeholder="Signature header (optional)" value={signatureHeader} onChange={(e) => setSignatureHeader(e.target.value)} />
                            <div />
                        </div>
                    )}

                    <div className="mt-3">
                        <Button onClick={createChannel}>Create channel</Button>
                    </div>

                    <div className="mt-6 border-t pt-4">
                        <p className="mb-2 text-sm text-zinc-400">End-to-end test: generate an AI summary for a protocol and deliver notifications to your configured channels.</p>
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_auto]">
                            <Input className="min-w-0" placeholder="protocol slug (e.g. serum)" value={testProtocol} onChange={(e) => setTestProtocol(e.target.value)} />
                            <select className="h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-100" value={testChannelId} onChange={(e) => setTestChannelId(e.target.value)}>
                                <option value="">All enabled channels</option>
                                {channels.filter((channel) => channel.enabled).map((channel) => (
                                    <option key={channel.id} value={channel.id}>{channel.name ?? channel.type}</option>
                                ))}
                            </select>
                            <Button onClick={async () => {
                                if (testingRef.current) return
                                if (!walletAddress) { toast.error('Wallet identity not ready'); return }
                                if (!testProtocol) { toast.error('Enter a protocol slug'); return }
                                testingRef.current = true
                                setTesting(true)
                                try {
                                    const res = await fetch('/api/test/e2e', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ walletAddress, protocolSlug: testProtocol, channelId: testChannelId || undefined }),
                                    })
                                    const body = await res.json().catch(() => null)
                                    if (!res.ok) throw new Error(body?.error ?? 'E2E test failed')
                                    const sent = Number(body?.delivery?.sent ?? 0)
                                    const failed = Number(body?.delivery?.failed ?? 0)
                                    toast.success(`E2E test complete: ${sent} sent, ${failed} failed.`)
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
                                    testingRef.current = false
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
                                <div key={ch.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold">{ch.name ?? ch.type}</div>
                                        <div className="text-xs text-zinc-500">{ch.type} • {ch.enabled ? 'enabled' : 'disabled'}</div>
                                        <div className="mt-1 break-all text-xs text-zinc-400 md:truncate md:max-w-xl">{maskWebhookUrl(ch.config.url)}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 md:justify-end">
                                        <Button variant="outline" onClick={() => testSend(ch.id)}>Test</Button>
                                        <Button variant="outline" onClick={() => editChannel(ch.id)}>Edit</Button>
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
