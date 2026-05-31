const prismaMock = {
    alertEvent: {
        findUnique: jest.fn(),
    },
    notificationChannel: {
        findMany: jest.fn(),
    },
    notificationLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
}

export {}

jest.mock('@/server/db/prisma', () => ({
    prisma: prismaMock,
}))

jest.mock('@/server/notifications/adapters/discord', () => ({
    sendDiscordWebhook: jest.fn(),
}))

jest.mock('@/server/notifications/adapters/webhook', () => ({
    sendGenericWebhook: jest.fn(),
}))

describe('deliverNotificationsForEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        prismaMock.alertEvent.findUnique.mockResolvedValue({
            id: 'event-1',
            walletAddress: 'wallet-1',
            protocolSlug: 'serum',
            metric: 'CHANGE_1D',
            threshold: 0,
            direction: 'ABOVE',
            currentValue: 0,
            triggeredAt: new Date('2026-05-31T00:00:00.000Z'),
            summary: 'summary',
        })
        prismaMock.notificationChannel.findMany.mockResolvedValue([])
    })

    it('queries all enabled wallet channels by default', async () => {
        const { deliverNotificationsForEvent } = await import('@/server/notifications/delivery')

        await deliverNotificationsForEvent('event-1')

        expect(prismaMock.notificationChannel.findMany).toHaveBeenCalledWith({
            where: {
                walletAddress: 'wallet-1',
                enabled: true,
            },
        })
    })

    it('can target one enabled channel by id', async () => {
        const { deliverNotificationsForEvent } = await import('@/server/notifications/delivery')

        await deliverNotificationsForEvent('event-1', 5, { channelId: 'channel-1' })

        expect(prismaMock.notificationChannel.findMany).toHaveBeenCalledWith({
            where: {
                walletAddress: 'wallet-1',
                enabled: true,
                id: 'channel-1',
            },
        })
    })
})
