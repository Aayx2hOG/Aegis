export function formatUsd(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'Unavailable'

  const abs = Math.abs(num)
  const maximumFractionDigits = abs > 0 && abs < 1 ? 8 : 2

  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`
}

export function formatTokenUsd(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'Unavailable'

  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  })}`
}
