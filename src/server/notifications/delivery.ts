import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendTelegramMessage } from '@/server/notifications/adapters/telegram'
import { normalizeNotificationConfig } from '@/server/notifications/config'

type DeliverResult = {
  sent: number
  failed: number
  failures: Array<{ channelId: string; error: string }>
}

type DeliverOptions = {
  channelId?: string
}

const PENDING_RETRY_MS = 1000 * 60 * 10

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function deliverNotificationsForEvent(
  eventId: string,
  concurrency = 5,
  options: DeliverOptions = {},
): Promise<DeliverResult> {
  if (!prisma) throw new Error('Database not configured.')
  const db = prisma

  const event = await db.alertEvent.findUnique({ where: { id: eventId } })
  if (!event) throw new Error('Alert event not found')

  const channels = await db.notificationChannel.findMany({
    where: {
      walletAddress: event.walletAddress,
      enabled: true,
      ...(options.channelId ? { id: options.channelId } : {}),
    },
  })

  let sent = 0
  let failed = 0
  const failures: Array<{ channelId: string; error: string }> = []
  const targetKeys = new Set<string>()
  const deliverableChannels: Array<{
    channel: (typeof channels)[number]
    cfg: ReturnType<typeof normalizeNotificationConfig>
  }> = []

  for (const channel of channels) {
    try {
      const cfg = normalizeNotificationConfig(channel.config, channel.type)
      const targetKey =
        channel.type === 'TELEGRAM' ? `${channel.type}:${cfg.botToken}:${cfg.chatId}` : `${channel.type}:${cfg.url}`
      if (targetKeys.has(targetKey)) continue

      targetKeys.add(targetKey)
      deliverableChannels.push({ channel, cfg })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const log = await db.notificationLog.upsert({
        where: { eventId_channelId: { eventId: event.id, channelId: channel.id } },
        create: { eventId: event.id, channelId: channel.id, status: 'FAILED', error: message },
        update: { status: 'FAILED', error: message },
      })
      if (log.status !== 'SENT') {
        failed += 1
        failures.push({ channelId: channel.id, error: message })
      }
    }
  }

  for (let i = 0; i < deliverableChannels.length; i += concurrency) {
    const batch = deliverableChannels.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async ({ channel: ch, cfg }) => {
        let log: Awaited<ReturnType<typeof db.notificationLog.create>>

        try {
          log = await db.notificationLog.create({ data: { eventId: event.id, channelId: ch.id, status: 'PENDING' } })
        } catch (err) {
          if (!isUniqueConstraintError(err)) throw err

          const existingLog = await db.notificationLog.findUnique({
            where: { eventId_channelId: { eventId: event.id, channelId: ch.id } },
          })
          if (!existingLog || existingLog.status === 'SENT') return

          const pendingAgeMs = Date.now() - existingLog.createdAt.getTime()
          if (existingLog.status === 'PENDING' && existingLog.error == null && pendingAgeMs < PENDING_RETRY_MS) return

          log = await db.notificationLog.update({
            where: { id: existingLog.id },
            data: { status: 'PENDING', error: null },
          })
        }

        try {
          if (ch.type === 'DISCORD') {
            await sendDiscordWebhook(cfg.url!, event.summary ?? `Alert: ${event.protocolSlug}`)
          } else if (ch.type === 'TELEGRAM') {
            await sendTelegramMessage(cfg.botToken!, cfg.chatId!, event.summary ?? `Alert: ${event.protocolSlug}`)
          }

          await db.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
          sent += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[deliver-notifications] failed for channel', ch.id, message)
          await db.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: message } })
          failed += 1
          failures.push({ channelId: ch.id, error: message })
        }
      }),
    )
  }

  return { sent, failed, failures }
}

export default deliverNotificationsForEvent
