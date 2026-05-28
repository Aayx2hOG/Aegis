import React from 'react'
import ChannelManager from '@/components/notifications/channel-manager'

export const metadata = {
    title: 'Notifications',
}

export default function NotificationsSettingsPage() {
    return (
        <main className="mx-auto max-w-4xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-black">Notification settings</h1>
            <ChannelManager />
        </main>
    )
}
