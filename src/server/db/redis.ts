import Redis from 'ioredis';
import { prisma } from './prisma';

declare global {
  var __redis: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL;

const redisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: process.env.NODE_ENV === 'development' ? 5000 : 1000,
  enableOfflineQueue: true,
};

export const redis = redisUrl
  ? global.__redis ?? new Redis(redisUrl, redisOptions)
  : null;

if (process.env.NODE_ENV !== 'production' && redis) {
  global.__redis = redis;
}

export interface StreamAlertEvent {
  id: string;
  ruleId: string;
  walletAddress: string;
  protocolSlug: string;
  metric: string;
  threshold: number;
  direction: string;
  currentValue: number;
  summary?: string | null;
  summaryGeneratedAt?: string | Date | null;
  triggeredAt: string | Date;
}

export async function publishAlertEvent(
  type: 'EVENT_CREATED' | 'SUMMARY_COMPLETED',
  event: StreamAlertEvent
) {
  if (!redis) return;
  try {
    const channel = 'aegis-alerts';
    const payload = JSON.stringify({ type, event });
    await redis.publish(channel, payload);
    console.log(`[Redis Pub] Published ${type} for event ${event.id} to channel ${channel}`);
  } catch (err) {
    console.error('[Redis Pub] Failed to publish alert event:', err);
  }
}

export async function updateEventAndPublishSummary(eventId: string, summary: string | null) {
  if (!prisma) return null;
  
  const updatedEvent = await prisma.alertEvent.update({
    where: { id: eventId },
    data: { summary, summaryGeneratedAt: new Date() },
  });

  try {
    await publishAlertEvent('SUMMARY_COMPLETED', {
      id: updatedEvent.id,
      ruleId: updatedEvent.ruleId,
      walletAddress: updatedEvent.walletAddress,
      protocolSlug: updatedEvent.protocolSlug,
      metric: updatedEvent.metric,
      threshold: updatedEvent.threshold,
      direction: updatedEvent.direction,
      currentValue: updatedEvent.currentValue,
      triggeredAt: updatedEvent.triggeredAt,
      summary: updatedEvent.summary,
      summaryGeneratedAt: updatedEvent.summaryGeneratedAt,
    });
  } catch (err) {
    console.error('[updateEventAndPublishSummary] Failed to publish SUMMARY_COMPLETED to Redis:', err);
  }

  return updatedEvent;
}

