import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import deliverNotificationsForEvent from '@/server/notifications/delivery'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

function isE2eTestEnabled() {
  return process.env.AEGIS_ENABLE_E2E_TEST_API === 'true' || process.env.NODE_ENV !== 'production'
}

export async function POST(req: NextRequest) {
  if (!isE2eTestEnabled()) {
    return Response.json({ error: 'E2E test API is disabled in this environment.' }, { status: 404 })
  }

  if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503 })

  const body = await req.json().catch(() => null)
  const walletAddress = body?.walletAddress?.trim()
  const protocolSlug = body?.protocolSlug?.trim()
  const channelId = body?.channelId?.trim()

  if (!walletAddress || !protocolSlug) {
    return new Response(JSON.stringify({ error: 'walletAddress and protocolSlug are required' }), { status: 400 })
  }

  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    if (channelId) {
      const channel = await prisma.notificationChannel.findUnique({ where: { id: channelId } })
      if (!channel || channel.walletAddress !== auth.walletAddress) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), { status: 404 })
      }
      if (!channel.enabled) {
        return new Response(JSON.stringify({ error: 'Channel is disabled' }), { status: 409 })
      }
    }

    // Create a temporary rule to attach the event to
    const rule = await prisma.alertRule.create({
      data: {
        walletAddress: auth.walletAddress,
        protocolSlug,
        metric: 'CHANGE_1D',
        threshold: 0,
        direction: 'ABOVE',
        enabled: false,
      },
    })

    const event = await prisma.alertEvent.create({
      data: {
        ruleId: rule.id,
        walletAddress: auth.walletAddress,
        protocolSlug,
        metric: 'CHANGE_1D',
        threshold: 0,
        direction: 'ABOVE',
        currentValue: 0,
      },
    })

    // Track artifact for cleanup
    await prisma.testArtifact.create({
      data: { ruleId: rule.id, eventId: event.id, walletAddress: auth.walletAddress, protocolSlug },
    })

    const brief = await runResearchAgent(protocolSlug)
    const summary = typeof brief.brief === 'string' ? brief.brief : null
    await prisma.alertEvent.update({ where: { id: event.id }, data: { summary, summaryGeneratedAt: new Date() } })

    const delivery = await deliverNotificationsForEvent(event.id, 5, { channelId })

    // If Upstash is configured, enqueue a delayed cleanup message for this test artifact
    const UPSTASH_URL = process.env.UPSTASH_REST_URL
    const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN
    const TTL_MS = Number(process.env.TEST_ARTIFACT_TTL_MS ?? String(1000 * 60 * 60 * 24))
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const appUrl =
          process.env.APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const destinationUrl = `${appUrl}/api/queues/test-cleanup`
        const webhookSecret = process.env.UPSTASH_WEBHOOK_SECRET

        const baseUrl = UPSTASH_URL.replace(/\/$/, '')
        const baseWithoutV2 = baseUrl.endsWith('/v2') ? baseUrl.slice(0, -3) : baseUrl
        const url = `${baseWithoutV2}/v2/publish/${destinationUrl}`

        const delaySeconds = Math.floor(TTL_MS / 1000)

        const headers: Record<string, string> = {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Queue': 'test-cleanup',
          'Upstash-Delay': `${delaySeconds}s`,
          'Upstash-Forward-Content-Type': 'application/json',
        }

        if (webhookSecret) {
          headers['Upstash-Forward-Authorization'] = `Bearer ${webhookSecret}`
        }

        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: [{ body: { artifactId: event.id } }] }),
        })
      } catch (err) {
        console.error('[test-e2e] failed to enqueue delayed cleanup message', err)
      }
    }

    return new Response(JSON.stringify({ ok: true, eventId: event.id, delivery }))
  } catch (err) {
    console.error('[test-e2e] failed', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 })
  }
}
