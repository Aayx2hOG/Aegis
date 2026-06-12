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
    <div className="min-h-screen bg-[#070b13] flex items-center justify-center font-mono text-xs text-zinc-500">
      &gt; Redirecting to unified Alert Hub...
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
