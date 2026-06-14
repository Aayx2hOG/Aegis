import { NextRequest } from 'next/server'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import { prisma } from '@/server/db/prisma'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function GET(req: NextRequest) {
  if (!prisma) {
    return Response.json(
      { error: 'Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL.' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const walletAddress = url.searchParams.get('walletAddress')?.trim()
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    const profile = await prisma.walletProfile.findUnique({
      where: { walletAddress: auth.walletAddress },
      select: {
        walletAddress: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return Response.json({ profile })
  } catch (err) {
    const setupError = getDatabaseSetupErrorMessage(err)
    if (setupError) {
      return Response.json({ error: setupError }, { status: 503 })
    }

    return Response.json({ error: 'Wallet profile unavailable.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => null)) as Partial<{
    walletAddress: string
    displayName?: string | null
  }> | null
  const walletAddress = body?.walletAddress?.trim()
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : undefined

  if (!walletAddress) {
    return Response.json({ error: 'walletAddress is required' }, { status: 400 })
  }
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    const profile = await prisma.walletProfile.upsert({
      where: { walletAddress: auth.walletAddress },
      create: {
        walletAddress: auth.walletAddress,
        displayName: displayName || null,
      },
      update: {
        displayName: displayName || undefined,
      },
      select: {
        walletAddress: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return Response.json({ profile })
  } catch (err) {
    const setupError = getDatabaseSetupErrorMessage(err)
    if (setupError) {
      return Response.json({ error: setupError }, { status: 503 })
    }

    return Response.json({ error: 'Wallet profile unavailable.' }, { status: 500 })
  }
}
