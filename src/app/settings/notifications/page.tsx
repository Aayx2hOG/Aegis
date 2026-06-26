'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!searchParams.get('tab')) {
      router.replace('/alerts?tab=channels')
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#070b13] flex items-center justify-center px-4 text-center font-mono text-xs text-zinc-500">
      <div className="max-w-sm space-y-2">
        <p className="text-cyan-300">&gt; Advanced notifications moved into Alert Hub.</p>
        <p>Redirecting to Alerts / Notifications...</p>
      </div>
    </div>
  )
}

export default function NotificationsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <RedirectContent />
    </Suspense>
  )
}
