"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number; y: number; vx: number; vy: number
  color: string; size: number; gravity: number
  opacity: number; rotation: number; rotationSpeed: number
}

const COLORS = ["#f43f5e","#fb923c","#facc15","#4ade80","#38bdf8","#818cf8","#e879f9"]

export default function Confetti({ trigger }: { trigger: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const particles = useRef<Particle[]>([])

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    particles.current = Array.from({ length: 160 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 12 + 4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 9 + 4,
      gravity: 0.28,
      opacity: 1,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 9,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.current = particles.current.filter((p) => p.opacity > 0)
      particles.current.forEach((p) => {
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.opacity -= 0.011
        p.rotation += p.rotationSpeed
        p.vx *= 0.99
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5)
        ctx.restore()
      })
      if (particles.current.length > 0) {
        animRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ display: trigger ? "block" : "none" }}
    />
  )
}