'use client'

const TICKERS = ['SOL +2.14%', 'JTO -0.82%', 'KMNO -3.20%', 'TVL $1.07B', 'BASE +0.44%', 'ETH +1.08%']

export function MarketBackdrop() {
  return (
    <div className="market-backdrop pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="market-backdrop-image absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(34,211,238,0.13),transparent_34%),linear-gradient(90deg,rgba(3,7,18,0.96),rgba(3,7,18,0.54)_42%,rgba(3,7,18,0.9))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.72),transparent_30%,rgba(3,7,18,0.94))]" />

      <div className="market-ticker absolute bottom-10 left-0 flex w-max gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500/60">
        {[...TICKERS, ...TICKERS, ...TICKERS].map((ticker, index) => (
          <span key={`${ticker}-${index}`} className="rounded-full border border-white/5 bg-zinc-950/30 px-3 py-1">
            {ticker}
          </span>
        ))}
      </div>
    </div>
  )
}
