'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { WarRoomContent } from '@/components/war-room/war-room-content'

export default function WarRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <WarRoomContent />
    </Suspense>
  )
}
