'use client'

import { useEffect, useRef } from 'react'

export default function LandingGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = window.innerWidth
      // Cover entire page height
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        window.innerHeight * 4 // Fallback for initial load
      )
      
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.scale(dpr, dpr)
      
      return { width, height }
    }

    let { width, height } = setCanvasSize()

    // Gradient orbs for mesh effect - darker, more sophisticated tones
    const orbs = [
      { x: 0.1, y: 0.2, radius: 0.5, color: { h: 150, s: 45, l: 85 }, speed: 0.0002 },
      { x: 0.8, y: 0.1, radius: 0.6, color: { h: 160, s: 40, l: 82 }, speed: 0.00015 },
      { x: 0.5, y: 0.7, radius: 0.4, color: { h: 140, s: 35, l: 80 }, speed: 0.00025 },
      { x: 0.2, y: 0.8, radius: 0.35, color: { h: 170, s: 30, l: 78 }, speed: 0.0001 },
      { x: 0.9, y: 0.5, radius: 0.45, color: { h: 155, s: 38, l: 75 }, speed: 0.00018 },
    ]

    const handleResize = () => {
      const size = setCanvasSize()
      width = size.width
      height = size.height
    }

    const drawGradient = (time: number) => {
      // Base - slightly darker off-white with green tint
      ctx.fillStyle = '#F0F5F0'
      ctx.fillRect(0, 0, width, height)

      // Draw soft gradient orbs
      orbs.forEach((orb) => {
        const offsetX = Math.sin(time * orb.speed) * 50
        const offsetY = Math.cos(time * orb.speed * 0.8) * 30
        
        const x = orb.x * width + offsetX
        const y = orb.y * height + offsetY
        const radius = orb.radius * Math.min(width, height)

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        const { h, s, l } = orb.color
        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0.8)`)
        gradient.addColorStop(0.5, `hsla(${h}, ${s}%, ${l}%, 0.4)`)
        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`)
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      })
    }

    const animate = (time: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const dpr = window.devicePixelRatio || 1
      ctx.scale(dpr, dpr)
      
      drawGradient(time)
      animationRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('resize', handleResize)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ 
        background: 'linear-gradient(180deg, #F0F5F0 0%, #E8F0E8 100%)',
        width: '100vw',
        minHeight: '100vh'
      }}
    />
  )
}
