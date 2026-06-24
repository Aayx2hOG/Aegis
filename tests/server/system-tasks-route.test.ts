import { NextRequest } from 'next/server'

const findResearchRuns = jest.fn()
const findNotificationLogs = jest.fn()
const findAlertEvents = jest.fn()

jest.mock('@/server/db/prisma', () => ({
  prisma: {
    researchRun: { findMany: findResearchRuns },
    notificationLog: { findMany: findNotificationLogs },
    alertEvent: { findMany: findAlertEvents },
  },
}))

describe('/api/system/tasks', () => {
  beforeEach(() => {
    process.env.AEGIS_REQUIRE_WALLET_AUTH = ''
    findResearchRuns.mockReset()
    findNotificationLogs.mockReset()
    findAlertEvents.mockReset()
    findResearchRuns.mockResolvedValue([])
    findNotificationLogs.mockResolvedValue([])
    findAlertEvents.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.AEGIS_REQUIRE_WALLET_AUTH
  })

  it('requires a wallet address', async () => {
    const { GET } = await import('@/app/api/system/tasks/route')
    const res = await GET(new NextRequest('http://localhost/api/system/tasks'))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'walletAddress is required' })
    expect(findResearchRuns).not.toHaveBeenCalled()
  })

  it('scopes all task queries to the requested wallet', async () => {
    const { GET } = await import('@/app/api/system/tasks/route')
    const walletAddress = 'Wallet111111111111111111111111111111111'
    const res = await GET(new NextRequest(`http://localhost/api/system/tasks?walletAddress=${walletAddress}`))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, tasks: [] })
    expect(findResearchRuns).toHaveBeenCalledWith({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })
    expect(findNotificationLogs).toHaveBeenCalledWith({
      where: { channel: { walletAddress } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { channel: true },
    })
    expect(findAlertEvents).toHaveBeenCalledWith({
      where: { walletAddress },
      orderBy: { triggeredAt: 'desc' },
      take: 6,
    })
  })
})
