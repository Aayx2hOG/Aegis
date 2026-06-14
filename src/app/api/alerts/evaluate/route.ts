import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { evaluateAlertsForWallet } from '@/server/alerts/evaluator'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function POST(req: NextRequest) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  }

  const body = (await req.json()) as Partial<{ walletAddress: string }>
  const walletAddress = body.walletAddress?.trim()
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    const summary = await evaluateAlertsForWallet(auth.walletAddress)
    return Response.json(summary)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
