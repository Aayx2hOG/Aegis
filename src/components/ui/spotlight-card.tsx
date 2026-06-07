'use client'

import React, { useState } from 'react'

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(34, 211, 238, 0.12)',
  borderColor = 'rgba(34, 211, 238, 0.45)',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string
  borderColor?: string
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/40 p-6 shadow-2xl transition-all duration-500 hover:border-white/10 ${className}`}
      {...props}
    >
      {/* Spotlight Backing */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      {/* Glowing Border Overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          border: '1px solid transparent',
          backgroundImage: `linear-gradient(to bottom, transparent, transparent), radial-gradient(140px circle at ${coords.x}px ${coords.y}px, ${borderColor}, transparent 80%)`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
