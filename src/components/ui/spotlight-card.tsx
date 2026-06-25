'use client'

import React, { useEffect, useRef } from 'react'

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(34, 211, 238, 0.12)',
  borderColor = 'rgba(34, 211, 238, 0.45)',
  style,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string
  borderColor?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const latestPointRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  function flushSpotlightPosition() {
    const node = cardRef.current
    if (!node) return

    node.style.setProperty('--spotlight-x', `${latestPointRef.current.x}px`)
    node.style.setProperty('--spotlight-y', `${latestPointRef.current.y}px`)
    frameRef.current = null
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event)
    const node = cardRef.current
    if (!node) return

    const rect = node.getBoundingClientRect()
    latestPointRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(flushSpotlightPosition)
    }
  }

  function handlePointerEnter(event: React.PointerEvent<HTMLDivElement>) {
    onPointerEnter?.(event)
    cardRef.current?.setAttribute('data-spotlight-active', 'true')
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    onPointerLeave?.(event)
    cardRef.current?.removeAttribute('data-spotlight-active')
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`group/spotlight relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950/45 p-6 shadow-2xl shadow-black/25 transition-all duration-300 hover:border-white/15 ${className}`}
      style={
        {
          '--spotlight-color': spotlightColor,
          '--spotlight-border': borderColor,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* Spotlight Backing */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 motion-reduce:hidden group-hover/spotlight:opacity-100"
        style={{
          background:
            'radial-gradient(350px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), var(--spotlight-color), transparent 80%)',
        }}
      />
      {/* Glowing Border Overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 motion-reduce:hidden group-hover/spotlight:opacity-100"
        style={{
          border: '1px solid transparent',
          backgroundImage:
            'linear-gradient(to bottom, transparent, transparent), radial-gradient(140px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), var(--spotlight-border), transparent 80%)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
