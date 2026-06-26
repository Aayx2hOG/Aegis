'use client'

import { useCallback, useState } from 'react'
import type { WalletContextState } from '@solana/wallet-adapter-react'

type WalletChallenge = {
  message: string
  token: string
}

export function useWalletAuth(wallet: WalletContextState) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const authenticate = useCallback(async () => {
    const walletAddress = wallet.publicKey?.toBase58()
    if (!walletAddress) {
      throw new Error('Connect your wallet first.')
    }
    if (!wallet.signMessage) {
      throw new Error('This wallet does not support message signing.')
    }

    setIsAuthenticating(true)
    try {
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })
      const challenge = (await nonceRes.json().catch(() => null)) as (WalletChallenge & { error?: string }) | null
      if (!nonceRes.ok || !challenge?.message || !challenge.token) {
        throw new Error(challenge?.error ?? 'Failed to create wallet challenge.')
      }

      const encodedMessage = new TextEncoder().encode(challenge.message)
      const signature = await wallet.signMessage(encodedMessage)

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          walletAddress,
          message: challenge.message,
          challengeToken: challenge.token,
          signature: Array.from(signature),
        }),
      })
      const verified = (await verifyRes.json().catch(() => null)) as { error?: string } | null
      if (!verifyRes.ok) {
        throw new Error(verified?.error ?? 'Wallet authentication failed.')
      }

      return walletAddress
    } finally {
      setIsAuthenticating(false)
    }
  }, [wallet])

  return { authenticate, isAuthenticating }
}

