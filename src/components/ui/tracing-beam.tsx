'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function TracingBeam({ children, className }: { children: React.ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [svgHeight, setSvgHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setSvgHeight(contentRef.current.offsetHeight)
    }
  }, [])

  // Use a resize observer to dynamic size
  useEffect(() => {
    if (!contentRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgHeight(entry.contentRect.height)
      }
    })
    resizeObserver.observe(contentRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div className={cn('relative mx-auto flex w-full max-w-5xl flex-row gap-0 md:gap-10', className)}>
      <div className="relative left-0 hidden md:block shrink-0 mt-4">
        <svg
          viewBox={`0 0 20 ${svgHeight}`}
          width="20"
          height={svgHeight}
          className="absolute left-0 top-0 block"
          aria-hidden="true"
        >
          <path d={`M 10 0 V ${svgHeight}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          <path
            d={`M 10 0 V ${svgHeight}`}
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(svgHeight * 0.35, 120)} ${Math.max(svgHeight, 1)}`}
            className="motion-safe:animate-[trace-beam_7s_ease-in-out_infinite]"
          />
          <defs>
            <linearGradient id="beam-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#a1a1aa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3f3f46" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {/* Glowing indicator dot */}
          <circle
            cx="10"
            cy={Math.max(42, Math.min(svgHeight - 42, svgHeight * 0.3))}
            r="5"
            fill="#ffffff"
            stroke="#a1a1aa"
            strokeWidth="1.5"
            style={{
              filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))',
            }}
          />
        </svg>
      </div>
      <div ref={contentRef} className="flex-grow min-w-0">
        {children}
      </div>
    </div>
  )
}
