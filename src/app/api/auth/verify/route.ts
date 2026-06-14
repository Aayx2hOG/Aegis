import { NextRequest } from 'next/server'
import { getSessionCookieHeader, verifyWalletSignature } from '@/server/auth/wallet-auth'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<{
    walletAddress: string
    message: string
    signature: string | number[]
    challengeToken: string
  }> | null

  if (!body?.walletAddress || !body.message || !body.signature || !body.challengeToken) {
    return Response.json(
      { error: 'walletAddress, message, signature, and challengeToken are required' },
      { status: 400 },
    )
  }

  const sessionToken = verifyWalletSignature({
    walletAddress: body.walletAddress.trim(),
    message: body.message,
    signature: body.signature,
    challengeToken: body.challengeToken,
  })

  if (!sessionToken) {
    return Response.json({ error: 'Invalid wallet signature' }, { status: 401 })
  }

  return Response.json(
    { token: sessionToken, walletAddress: body.walletAddress.trim() },
    { headers: { 'Set-Cookie': getSessionCookieHeader(sessionToken) } },
  )
}
