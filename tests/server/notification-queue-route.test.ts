import { NextRequest } from 'next/server'

const mockDeliver = jest.fn()

jest.mock('@/server/db/prisma', () => ({
  prisma: {},
}))

jest.mock('@/server/notifications/delivery', () => ({
  __esModule: true,
  default: mockDeliver,
}))

describe('notification queue route', () => {
  beforeEach(() => {
    mockDeliver.mockReset()
    mockDeliver.mockResolvedValue({ sent: 2, failed: 0, failures: [] })
  })

  it('delivers a QStash message batch', async () => {
    const { POST } = await import('@/app/api/queues/notifications/route')
    const req = new NextRequest('http://localhost/api/queues/notifications', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ body: { eventId: 'event-1' } }] }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockDeliver).toHaveBeenCalledWith('event-1')
  })

  it('also accepts a direct event payload', async () => {
    const { POST } = await import('@/app/api/queues/notifications/route')
    const req = new NextRequest('http://localhost/api/queues/notifications', {
      method: 'POST',
      body: JSON.stringify({ eventId: 'event-2' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockDeliver).toHaveBeenCalledWith('event-2')
  })

  it('returns a retryable error when a channel delivery fails', async () => {
    mockDeliver.mockResolvedValue({
      sent: 1,
      failed: 1,
      failures: [{ channelId: 'telegram-1', error: 'Telegram send failed' }],
    })
    const { POST } = await import('@/app/api/queues/notifications/route')
    const req = new NextRequest('http://localhost/api/queues/notifications', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ body: { eventId: 'event-3' } }] }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(503)
  })
})
