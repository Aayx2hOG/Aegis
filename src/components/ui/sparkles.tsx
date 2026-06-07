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

    // Particle representation
    class Particle {
      x: number = 0
      y: number = 0
      size: number = 0
      speedX: number = 0
      speedY: number = 0
      opacity: number = 0
      fadeSpeed: number = 0

      constructor() {
        this.reset()
      }

      reset() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.size = Math.random() * (maxSize - minSize) + minSize
        this.speedX = (Math.random() - 0.5) * 0.15
        this.speedY = (Math.random() - 0.5) * 0.15
        this.opacity = Math.random() * 0.5 + 0.1
        this.fadeSpeed = (Math.random() * 0.005 + 0.002) * (Math.random() > 0.5 ? 1 : -1)
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY
        this.opacity += this.fadeSpeed

        if (this.opacity <= 0.05 || this.opacity >= 0.8) {
          this.fadeSpeed = -this.fadeSpeed
        }

        // Boundary wrap
        if (this.x < 0) this.x = width
        if (this.x > width) this.x = 0
        if (this.y < 0) this.y = height
        if (this.y > height) this.y = 0
      }

      draw() {
        if (!ctx) return
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity))
        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    const particles: Particle[] = Array.from({ length: particleDensity }).map(() => new Particle())

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      particles.forEach((particle) => {
        particle.update()
        particle.draw()
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
