'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)

  const initParticles = useCallback((width: number, height: number) => {
    const particleCount = Math.floor((width * height) / 15000)
    const particles: Particle[] = []
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set initial size immediately
    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = window.innerWidth
      const height = window.innerHeight
      
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.scale(dpr, dpr)
      
      return { width, height }
    }

    const { width, height } = setCanvasSize()
    initParticles(width, height)

    const handleResize = () => {
      const { width, height } = setCanvasSize()
      initParticles(width, height)
    }

    const drawGradient = (time: number, w: number, h: number) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h)
      const shift = Math.sin(time * 0.0005) * 0.1
      
      gradient.addColorStop(0, `hsl(${160 + shift * 20}, 60%, 8%)`)
      gradient.addColorStop(0.3, `hsl(${170 + shift * 30}, 50%, 12%)`)
      gradient.addColorStop(0.6, `hsl(${180 + shift * 20}, 45%, 15%)`)
      gradient.addColorStop(1, `hsl(${140 + shift * 25}, 55%, 10%)`)
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }

    const drawParticles = (w: number, h: number) => {
      particlesRef.current.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY

        if (particle.x < 0) particle.x = w
        if (particle.x > w) particle.x = 0
        if (particle.y < 0) particle.y = h
        if (particle.y > h) particle.y = 0

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        
        const glow = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        )
        glow.addColorStop(0, `rgba(16, 185, 129, ${particle.opacity})`)
        glow.addColorStop(0.5, `rgba(20, 184, 166, ${particle.opacity * 0.5})`)
        glow.addColorStop(1, 'rgba(16, 185, 129, 0)')
        
        ctx.fillStyle = glow
        ctx.fill()
      })
    }

    const animate = (time: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const dpr = window.devicePixelRatio || 1
      ctx.scale(dpr, dpr)
      
      drawGradient(time, w, h)
      drawParticles(w, h)
      animationRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('resize', handleResize)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [initParticles])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-screen h-screen"
      style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)',
        width: '100vw',
        height: '100vh'
      }}
    />
  )
}
