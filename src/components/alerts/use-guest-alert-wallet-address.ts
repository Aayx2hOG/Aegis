'use client'

import { useEffect, useState } from 'react'

export function useGuestAlertWalletAddress() {
  const [guestAlertWalletAddress, setGuestAlertWalletAddress] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storageKey = 'aegis-alert-guest-id'
    const existing = window.localStorage.getItem(storageKey)
    if (existing) {
      queueMicrotask(() => setGuestAlertWalletAddress(existing))
      return
    }

    const generated = `guest-${crypto.randomUUID()}`
    window.localStorage.setItem(storageKey, generated)
    queueMicrotask(() => setGuestAlertWalletAddress(generated))
  }, [])

  return guestAlertWalletAddress
}
