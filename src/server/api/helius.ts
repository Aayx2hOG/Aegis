import type { ParsedTransaction } from '@/shared/types/protocol'

const BASE = 'https://api.helius.xyz/v0'
const KEY = process.env.HELIUS_API_KEY!

export async function getRecentTransactions(address: string, limit = 10): Promise<ParsedTransaction[]> {
  const res = await fetch(`${BASE}/addresses/${address}/transactions?api-key=${KEY}&limit=${limit}`)
  if (!res.ok) throw new Error(`Helius error: ${res.status}`)
  return res.json()
}

export async function getTokenMetadata(mint: string) {
  const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAsset',
      params: { id: mint },
    }),
  })
  if (!res.ok) throw new Error(`Helius DAS error: ${res.status}`)
  const { result } = await res.json()
  return result
}