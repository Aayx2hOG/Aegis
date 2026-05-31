const sendDiscordWebhook = jest.fn()
const sendGenericWebhook = jest.fn()

const prismaMock = {
    notificationChannel: {
        findUnique: jest.fn(),
    },
    notificationLog: {
        create: jest.fn(),
    },
}

export {}

jest.mock('@/server/db/prisma', () => ({
    prisma: prismaMock,
}))

jest.mock('@/server/notifications/adapters/discord', () => ({
    sendDiscordWebhook: (...args: unknown[]) => sendDiscordWebhook(...args),
}))

jest.mock('@/server/notifications/adapters/webhook', () => ({
    sendGenericWebhook: (...args: unknown[]) => sendGenericWebhook(...args),
}))

describe('notification channel test route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('blocks disabled channels from sending tests', async () => {
        prismaMock.notificationChannel.findUnique.mockResolvedValue({
            id: 'channel-1',
            walletAddress: 'wallet-1',
            enabled: false,
            type: 'DISCORD',
            config: { url: 'https://discord.com/api/webhooks/123/token' },
        })

        const { POST } = await import('@/app/api/notifications/channels/[id]/test/route')
        const request = new Request('http://localhost/api/notifications/channels/channel-1/test', { method: 'POST', body: JSON.stringify({ walletAddress: 'wallet-1', message: 'hello' }) }) as Parameters<typeof POST>[0]
        const response = await POST(request, {
            params: Promise.resolve({ id: 'channel-1' }),
        })

        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toEqual({ error: 'Channel is disabled' })
        expect(sendDiscordWebhook).not.toHaveBeenCalled()
        expect(sendGenericWebhook).not.toHaveBeenCalled()
        expect(prismaMock.notificationLog.create).not.toHaveBeenCalled()
    })
})
