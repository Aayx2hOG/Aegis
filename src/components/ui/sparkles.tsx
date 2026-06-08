'use client'

import React, { useRef, useEffect } from 'react'

interface SparklesProps {
  id?: string
  background?: string
  minSize?: number
  maxSize?: number
  particleDensity?: number
  className?: string
  particleColor?: string
}

export function Sparkles({
  id = 'sparkles',
  minSize = 0.6,
  maxSize = 1.8,
  particleDensity = 100,
  className = '',
  particleColor = '#22d3ee',
}: SparklesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = canvas.offsetWidth)
    let height = (canvas.height = canvas.offsetHeight)

    // Handle resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvas) {
          width = canvas.width = entry.contentRect.width
          height = canvas.height = entry.contentRect.height
        }
      }
    })
    resizeObserver.observe(canvas)

    interface Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
      fadeSpeed: number
    }

    const createParticle = (): Particle => {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * (maxSize - minSize) + minSize,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.5 + 0.1,
        fadeSpeed: (Math.random() * 0.005 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
      }
    }

    const updateParticle = (p: Particle) => {
      p.x += p.speedX
      p.y += p.speedY
      p.opacity += p.fadeSpeed

      if (p.opacity <= 0.05 || p.opacity >= 0.8) {
        p.fadeSpeed = -p.fadeSpeed
      }

      // Boundary wrap
      if (p.x < 0) p.x = width
      if (p.x > width) p.x = 0
      if (p.y < 0) p.y = height
      if (p.y > height) p.y = 0
    }

    const drawParticle = (p: Particle) => {
      if (!ctx) return
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity))
      ctx.fillStyle = particleColor
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const particles: Particle[] = Array.from({ length: particleDensity }).map(createParticle)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      particles.forEach((particle) => {
        updateParticle(particle)
        drawParticle(particle)
      })
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
    }
  }, [maxSize, minSize, particleColor, particleDensity])

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={`absolute inset-0 w-full h-full pointer-events-none z-0 ${className}`}
    />
  )
}
