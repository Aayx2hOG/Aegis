import { formatTokenUsd } from '@/lib/format/number'

export function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'unavailable'
  return formatTokenUsd(value)
}

export function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  let decimals = 0
  if (absValue > 0 && absValue < 1) {
    decimals = 4
  } else if (absValue > 0 && absValue < 100) {
    decimals = 2
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function getRiskBand(score: number): { label: 'Low' | 'Medium' | 'High'; color: string } {
  if (score < 34) return { label: 'Low', color: 'text-emerald-400' }
  if (score < 67) return { label: 'Medium', color: 'text-amber-400' }
  return { label: 'High', color: 'text-rose-400' }
}
