import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

type ParticlesProps = {
  quantity?: number
  size?: number
  color?: string
  vx?: number
  vy?: number
  style?: CSSProperties
}

type Dot = { x: number; y: number; r: number; alpha: number; targetAlpha: number; dx: number; dy: number }

// Adapted from Magic UI `particles`: same drifting, fading dots, but without the mouse
// tracking (it re-rendered React on every mouse move) and without Tailwind.
export function Particles({ quantity = 60, size = 1.5, color = '#ffffff', vx = 0.1, vy = 0, style }: ParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!container || !canvas || !ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = window.devicePixelRatio || 1
    const hex = color.replace('#', '')
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')

    const makeDot = (): Dot => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: size * (0.6 + Math.random() * 0.9),
      alpha: 0,
      targetAlpha: 0.1 + Math.random() * 0.45,
      dx: (Math.random() - 0.5) * 0.15,
      dy: (Math.random() - 0.5) * 0.15,
    })
    let dots: Dot[] = []

    const resize = () => {
      w = container.offsetWidth
      h = container.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = Array.from({ length: quantity }, makeDot)
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        d.alpha = Math.min(d.alpha + 0.01, d.targetAlpha)
        d.x += d.dx + vx
        d.y += d.dy + vy
        // wrap around so mist keeps drifting across the screen
        if (d.x > w + d.r) d.x = -d.r
        if (d.x < -d.r) d.x = w + d.r
        if (d.y > h + d.r) d.y = -d.r
        if (d.y < -d.r) d.y = h + d.r
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${d.alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    tick()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [quantity, size, color, vx, vy])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
