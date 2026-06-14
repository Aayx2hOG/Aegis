import { NextRequest } from 'next/server'
import { createWalletChallenge } from '@/server/auth/wallet-auth'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<{ walletAddress: string }> | null
  const walletAddress = body?.walletAddress?.trim()

  if (!walletAddress) {
    return Response.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  return Response.json(createWalletChallenge(walletAddress))
}
