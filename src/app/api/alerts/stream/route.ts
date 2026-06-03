import { NextRequest } from 'next/server';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetWalletAddress = searchParams.get('walletAddress')?.trim();

  if (!targetWalletAddress) {
    return new Response(JSON.stringify({ error: 'walletAddress is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return new Response(JSON.stringify({ error: 'Redis is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const customOptions = {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  };
  const subscriber = new Redis(redisUrl, customOptions);

  const stream = new ReadableStream({
    async start(controller) {
      // Send connection established confirmation
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      // Keep connection alive with 15-second heartbeat
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Stream already closed
        }
      }, 15000);

      // Subscribe to Redis alerts channel
      try {
        await subscriber.subscribe('aegis-alerts');
      } catch (err) {
        console.error('[SSE Server] Redis subscription failed:', err);
        controller.error(err);
        clearInterval(heartbeatTimer);
        subscriber.disconnect();
        return;
      }

      subscriber.on('message', (channel, message) => {
        if (channel !== 'aegis-alerts') return;

        try {
          const payload = JSON.parse(message);
          const event = payload.event;
          
          // Check if this event belongs to the client's walletAddress
          if (event && event.walletAddress === targetWalletAddress) {
            controller.enqueue(encoder.encode(`event: message\ndata: ${message}\n\n`));
          }
        } catch (err) {
          console.error('[SSE Server] Error parsing Redis payload:', err);
        }
      });

      // Cleanup when request is aborted (aborted by browser closing or reloading)
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        subscriber.unsubscribe('aegis-alerts').catch(() => {});
        subscriber.disconnect();
        controller.close();
      });
    },
    cancel() {
      subscriber.unsubscribe('aegis-alerts').catch(() => {});
      subscriber.disconnect();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
