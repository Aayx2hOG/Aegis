'use client'

import { useEffect, useState } from 'react'

export function Meteors({ number = 20 }: { number?: number }) {
  const [meteorStyles, setMeteorStyles] = useState<
    Array<{ top: string; left: string; animationDelay: string; animationDuration: string }>
  >([])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    const safeNumber = Math.min(Math.max(0, number), 8)
    const styles = Array.from({ length: safeNumber }).map(() => ({
      top: '0px',
      left: Math.floor(Math.random() * 800 - 400) + 'px',
      animationDelay: (Math.random() * (0.8 - 0.2) + 0.2).toFixed(2) + 's',
      animationDuration: Math.floor(Math.random() * (10 - 2) + 2) + 's',
    }))
    const timeoutId = setTimeout(() => {
      setMeteorStyles(styles)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [number])

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {meteorStyles.map((style, idx) => (
          <span
            key={'meteor' + idx}
            className="absolute top-1/2 left-1/2 h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
            style={{
              top: style.top,
              left: style.left,
              animationDelay: style.animationDelay,
              animationDuration: style.animationDuration,
            }}
          >
            {/* Meteor Tail */}
            <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-0 h-[1px] w-[50px] -translate-x-full bg-gradient-to-r from-slate-500 to-transparent" />
          </span>
        ))}
      </div>
      <style jsx global>{`
        @keyframes meteor {
          0% {
            transform: rotate(215deg) translateX(0);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: rotate(215deg) translateX(-500px);
            opacity: 0;
          }
        }
        .animate-meteor {
          animation: meteor 5s linear infinite;
        }
      `}</style>
    </>
  )
}
