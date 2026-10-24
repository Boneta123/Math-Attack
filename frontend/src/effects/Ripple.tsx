import { memo } from 'react'
import type { CSSProperties } from 'react'

type RippleProps = {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  color?: string
  style?: CSSProperties
}

// Adapted from Magic UI `ripple` (plain CSS instead of Tailwind; keyframes live in beach.css).
export const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 8,
  color = '#ffffff',
  style,
}: RippleProps) {
  const mask = 'linear-gradient(to bottom, white, transparent)'
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        maskImage: mask,
        WebkitMaskImage: mask,
        ...style,
      }}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70
        return (
          <div
            key={i}
            className="bs-ripple"
            style={
              {
                '--i': i,
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: size,
                height: size,
                opacity: Math.max(mainCircleOpacity - i * 0.03, 0),
                animationDelay: `${i * 0.06}s`,
                borderRadius: '50%',
                border: `1px solid ${color}`,
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                transform: 'translate(-50%, -50%) scale(1)',
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
})
