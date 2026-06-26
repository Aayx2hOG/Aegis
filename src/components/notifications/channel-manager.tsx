'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useMultiChain } from '@/components/chain/chain-provider'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import { HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

type Channel = {
  id: string
  walletAddress: string
  name?: string | null
  type: 'DISCORD' | 'TELEGRAM'
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

function maskChannelConfig(ch: Channel) {
  if (ch.type === 'DISCORD') {
    const rawUrl = ch.config.url
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return 'URL not configured'
    try {
      const parsed = new URL(rawUrl)
      const tail = parsed.pathname.split('/').filter(Boolean).at(-1)?.slice(-4)
      return `${parsed.origin}/...${tail ? tail : ''}`
    } catch {
      return 'Configured URL'
    }
  } else if (ch.type === 'TELEGRAM') {
    const botToken = String(ch.config.botToken ?? '')
    const chatId = String(ch.config.chatId ?? '')
    const maskedToken = botToken.length > 8 ? `${botToken.slice(0, 4)}...${botToken.slice(-4)}` : 'Token Configured'
    return `Bot: ${maskedToken} • Chat: ${chatId}`
  }
  return 'Configured'
}

function isChannelType(value: string): value is Channel['type'] {
  return value === 'DISCORD' || value === 'TELEGRAM'
}

const EXCLUDED_PROTOCOL_CATEGORIES = new Set([
  'CEX',
  'CeFi',
  'Centralized Exchange',
  'Indexes',
  'Portfolio Tracker',
  'Risk Curators',
  'Wallet',
])

export default function ChannelManager() {
  const wallet = useWallet()
  const { activeChain } = useMultiChain()
  const { data: rawChainProtocols = [] } = useChainProtocols(activeChain.type)
  const chainProtocols = useMemo(() => {
    return rawChainProtocols.filter((p: { category?: string }) => {
      const category = p.category?.trim() ?? 'Uncategorized'
      return !EXCLUDED_PROTOCOL_CATEGORIES.has(category)
    })
  }, [rawChainProtocols])
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)

  // Create form
  const [name, setName] = useState('')
  const [type, setType] = useState<'DISCORD' | 'TELEGRAM'>('DISCORD')
  const [url, setUrl] = useState('')
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [testProtocol, setTestProtocol] = useState('')
  const [testChannelId, setTestChannelId] = useState('')
  const [testing, setTesting] = useState(false)
  const testingRef = useRef(false)
  const [showGuide, setShowGuide] = useState(false)

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
      const configPayload =
        type === 'TELEGRAM' ? { botToken: botToken.trim(), chatId: chatId.trim() } : { url: url.trim() }

      const res = await fetch('/api/notifications/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, type, name: name || undefined, config: configPayload }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Create failed')
      toast.success('Channel created')
      setName('')
      setUrl('')
      setBotToken('')
      setChatId('')
      await loadChannels()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to create channel')
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
      const res = await fetch(`/api/notifications/channels/${id}?walletAddress=${encodeURIComponent(walletAddress)}`, {
        method: 'DELETE',
      })
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
      const res = await fetch(`/api/notifications/channels/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, message: 'Test notification from Aegis' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Test send failed')
      toast.success('Test sent')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Test send failed')
    }
  }

  async function editChannel(id: string) {
    if (!walletAddress) {
      toast.error('Wallet identity not ready')
      return
    }
    const ch = channels.find((c) => c.id === id)
    if (!ch) {
      toast.error('Channel not found')
      return
    }

    let configPayload: Record<string, unknown> = {}

    if (ch.type === 'DISCORD') {
      const newUrl = prompt('Webhook URL', String(ch.config?.url ?? ''))
      if (newUrl == null) return
      configPayload = { url: newUrl }
    } else if (ch.type === 'TELEGRAM') {
      const newBotToken = prompt('Telegram Bot Token', String(ch.config?.botToken ?? ''))
      if (newBotToken == null) return
      const newChatId = prompt('Telegram Chat ID', String(ch.config?.chatId ?? ''))
      if (newChatId == null) return
      configPayload = { botToken: newBotToken, chatId: newChatId }
    }

    try {
      const res = await fetch(`/api/notifications/channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, config: configPayload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Update failed')
      }
      toast.success('Channel updated')
      await loadChannels()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to update channel')
    }
  }

  return (
    <div className="space-y-6">
      <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-4 shadow-2xl">
        <div className="border-b border-cyan-500/10 pb-3">
          <h3 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">
            Notification Channels
          </h3>
        </div>
        <div className="space-y-4">
          <div className="text-xs font-mono text-zinc-450">
            &gt; Manage where alert summaries are delivered for your wallet identity.
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Input
              placeholder="Channel name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs bg-zinc-950 border-zinc-800 text-white font-mono rounded-xs focus:border-cyan-500/30"
            />
            <select
              className="flex h-9 w-full rounded-xs border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-white font-mono focus:border-cyan-500/30 transition-colors cursor-pointer"
              value={type}
              onChange={(e) => {
                if (isChannelType(e.target.value)) setType(e.target.value)
              }}
            >
              <option value="DISCORD" className="bg-zinc-950 text-white font-mono">
                Discord webhook
              </option>
              <option value="TELEGRAM" className="bg-zinc-950 text-white font-mono">
                Telegram Bot
              </option>
            </select>
            {type === 'DISCORD' && (
              <Input
                placeholder="Webhook URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-9 text-xs bg-zinc-950 border-zinc-800 text-white font-mono rounded-xs focus:border-cyan-500/30"
              />
            )}
            {type === 'TELEGRAM' && (
              <Input
                placeholder="Telegram Bot Token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="h-9 text-xs bg-zinc-950 border-zinc-800 text-white font-mono rounded-xs focus:border-cyan-500/30"
              />
            )}
          </div>

          {type === 'TELEGRAM' && (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <Input
                placeholder="Telegram Chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="h-9 text-xs bg-zinc-950 border-zinc-800 text-white font-mono rounded-xs focus:border-cyan-500/30"
              />
              <div />
              <div />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              onClick={createChannel}
              className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all px-4 py-2 text-xs cursor-pointer"
            >
              Create channel
            </Button>

            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 outline-none select-none"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{showGuide ? 'Hide Setup Guide' : 'How do I set this up?'}</span>
              {showGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {showGuide && (
            <div className="mt-4 border border-cyan-500/25 bg-zinc-950/90 p-5 rounded-xs text-sm font-sans tracking-wide space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 border-b border-cyan-500/20 pb-2.5 font-orbitron font-bold uppercase tracking-wider text-xs">
                <HelpCircle className="h-4.5 w-4.5 text-cyan-400" />
                <span>
                  {type === 'DISCORD' ? 'Discord Webhook Integration Guide' : 'Telegram Bot Integration Guide'}
                </span>
              </div>
              {type === 'DISCORD' ? (
                <ol className="list-decimal list-inside space-y-2.5 text-zinc-100 pl-1 leading-relaxed">
                  <li>
                    Open <span className="text-white font-bold">Discord</span> and go to the server where you want to receive alerts.
                  </li>
                  <li>
                    Go to <span className="text-white font-bold">Server Settings</span> &gt;{' '}
                    <span className="text-white font-bold">Integrations</span> &gt;{' '}
                    <span className="text-white font-bold">Webhooks</span> (this requires the{' '}
                    <code className="text-cyan-300 font-bold bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-xs border border-zinc-800">Manage Webhooks</code> permission).
                  </li>
                  <li>
                    Click <span className="text-cyan-400 font-bold">Create Webhook</span> (or edit an existing one).
                  </li>
                  <li>
                    Select the target text channel, then click <span className="text-cyan-400 font-bold">Copy Webhook URL</span>.
                  </li>
                  <li>
                    Paste the copied URL into the <span className="text-white font-bold">Webhook URL</span> input field above.
                  </li>
                </ol>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="text-cyan-400 font-bold uppercase tracking-wider font-orbitron text-xs border-b border-zinc-850 pb-1.5">
                      Step 1: Create your Telegram Bot
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-zinc-100 pl-1 leading-relaxed">
                      <li>
                        Open Telegram, search for{' '}
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline inline-flex items-center gap-0.5"
                        >
                          @BotFather <ExternalLink className="h-3 w-3 inline" />
                        </a>
                        , and start a chat.
                      </li>
                      <li>
                        Send the command{' '}
                        <code className="bg-zinc-900 text-cyan-300 px-1.5 py-0.5 rounded border border-zinc-800 font-mono text-xs">
                          /newbot
                        </code>{' '}
                        and follow the instructions to choose a name and username.
                      </li>
                      <li>
                        Copy the <span className="text-cyan-400 font-bold">HTTP API Token</span> provided (looks like{' '}
                        <code className="bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-xs border border-zinc-800">123456789:ABCdef...</code>) and
                        paste it in the <span className="text-white font-bold">Telegram Bot Token</span> field above.
                      </li>
                    </ol>
                  </div>
                  <div className="space-y-2.5 pt-2">
                    <div className="text-cyan-400 font-bold uppercase tracking-wider font-orbitron text-xs border-b border-zinc-850 pb-1.5">
                      Step 2: Retrieve your Chat ID
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-zinc-100 pl-1 leading-relaxed">
                      <li>
                        Create a new Telegram Group/Channel (or open an existing one) and add your bot as an{' '}
                        <span className="text-white font-bold">administrator</span>.
                      </li>
                      <li>
                        Post a message in that group or channel (e.g.,{' '}
                        <code className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded font-mono text-xs border border-zinc-800">hello</code>).
                      </li>
                      <li>
                        Search for{' '}
                        <a
                          href="https://t.me/raw_data_bot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline inline-flex items-center gap-0.5"
                        >
                          @raw_data_bot <ExternalLink className="h-3 w-3 inline" />
                        </a>{' '}
                        (or{' '}
                        <a
                          href="https://t.me/userinfobot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline inline-flex items-center gap-0.5"
                        >
                          @userinfobot <ExternalLink className="h-3 w-3 inline" />
                        </a>
                        ), start it, and forward the message you sent in your group/channel to it.
                      </li>
                      <li>
                        It will reply with details. Copy the <span className="text-cyan-400 font-bold">Chat ID</span> (usually starts with a minus sign for groups, e.g.,{' '}
                        <code className="bg-zinc-900 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-xs border border-zinc-800">-10023456789</code>) and paste it
                        into the <span className="text-white font-bold">Telegram Chat ID</span> field above.
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-zinc-900 pt-4 space-y-3">
            <p className="text-xs font-mono text-zinc-400">
              &gt; End-to-end test: generate an optional protocol summary and deliver notifications to your configured
              channels.
            </p>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_auto] items-center">
              <Input
                className="min-w-0 h-9 text-xs bg-zinc-950 border-zinc-800 text-white font-mono rounded-xs focus:border-cyan-500/30"
                placeholder="protocol slug (e.g. serum)"
                value={testProtocol}
                onChange={(e) => setTestProtocol(e.target.value)}
              />
              <select
                className="flex h-9 w-full rounded-xs border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-white font-mono focus:border-cyan-500/30 transition-colors cursor-pointer"
                value={testChannelId}
                onChange={(e) => setTestChannelId(e.target.value)}
              >
                <option value="" className="bg-zinc-950 text-white font-mono">
                  All enabled channels
                </option>
                {channels
                  .filter((channel) => channel.enabled)
                  .map((channel) => (
                    <option key={channel.id} value={channel.id} className="bg-zinc-950 text-white font-mono">
                      {channel.name ?? channel.type}
                    </option>
                  ))}
              </select>
              <Button
                onClick={async () => {
                  if (testingRef.current) return
                  if (!walletAddress) {
                    toast.error('Wallet identity not ready')
                    return
                  }
                  if (!testProtocol) {
                    toast.error('Enter a protocol slug')
                    return
                  }

                  const matched = resolveProtocolFromList(testProtocol.trim(), chainProtocols)
                  if (!matched) {
                    toast.error(`"${testProtocol}" is not a protocol on ${activeChain.displayName}`)
                    return
                  }

                  testingRef.current = true
                  setTesting(true)
                  try {
                    const res = await fetch('/api/test/e2e', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        walletAddress,
                        protocolSlug: matched.slug,
                        channelId: testChannelId || undefined,
                      }),
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
                    toast.error(err instanceof Error ? err.message : 'E2E test failed')
                  } finally {
                    testingRef.current = false
                    setTesting(false)
                  }
                }}
                disabled={testing}
                className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all px-4 py-2 text-xs cursor-pointer"
              >
                {testing ? 'Running…' : 'Run E2E test'}
              </Button>
            </div>
            <div id="e2e-result" className="mt-2 text-xs font-mono text-cyan-400" />
          </div>
        </div>
      </div>

      <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-4 shadow-2xl">
        <div className="border-b border-cyan-500/10 pb-3">
          <h3 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">Configured Channels</h3>
        </div>
        <div className="space-y-4">
          {loading ? (
            <div className="text-xs font-mono text-zinc-450">&gt; Loading…</div>
          ) : channels.length === 0 ? (
            <div className="text-xs font-mono text-zinc-450">&gt; No channels configured yet.</div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex flex-col gap-3 rounded-xs border border-zinc-900 bg-zinc-950/80 p-3.5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white text-sm font-orbitron tracking-wider">
                      {ch.name ?? ch.type}
                    </div>
                    <div className="text-xs font-mono text-zinc-400 mt-1">
                      {ch.type} • {ch.enabled ? 'enabled' : 'disabled'}
                    </div>
                    <div className="mt-1.5 break-all text-xs font-mono text-cyan-400 md:truncate md:max-w-xl">
                      {maskChannelConfig(ch)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => testSend(ch.id)}
                      className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
                    >
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => editChannel(ch.id)}
                      className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => toggleEnabled(ch.id, ch.enabled)}
                      className="text-zinc-400 hover:text-white font-mono text-xs px-3 py-1.5 cursor-pointer"
                    >
                      {ch.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteChannel(ch.id)}
                      className="border border-rose-500/20 bg-rose-500/10 text-rose-350 hover:bg-rose-500/20 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
