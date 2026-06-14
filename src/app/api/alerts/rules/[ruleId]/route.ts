import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function PATCH(req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  }

  const { ruleId } = await context.params
  const body = (await req.json()) as Partial<{ enabled: boolean; walletAddress?: string }>

  const auth = requireWalletOwner(req, body.walletAddress)
  if (!auth.ok) return auth.response

  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'enabled(boolean) is required' }, { status: 400 })
  }

  const rule = await prisma.alertRule.update({
    where: { id: ruleId, walletAddress: auth.walletAddress },
    data: { enabled: body.enabled },
  })

  return Response.json({ rule })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  }

  const { ruleId } = await context.params
  const walletAddress = new URL(req.url).searchParams.get('walletAddress')?.trim()
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  await prisma.alertRule.delete({ where: { id: ruleId, walletAddress: auth.walletAddress } })

  return new Response(null, { status: 204 })
}
