import { useId } from 'react'
import type { CSSProperties } from 'react'

type NoiseTextureProps = {
  frequency?: number
  octaves?: number
  slope?: number
  noiseOpacity?: number
  style?: CSSProperties
}

// Adapted from Magic UI `noise-texture` (SVG feTurbulence layer, no Tailwind).
export function NoiseTexture({
  frequency = 0.4,
  octaves = 6,
  slope = 0.15,
  noiseOpacity = 0.6,
  style,
}: NoiseTextureProps) {
  const filterId = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}
    >
      <filter id={filterId}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={octaves} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope={slope} />
          <feFuncG type="linear" slope={slope} />
          <feFuncB type="linear" slope={slope} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={noiseOpacity} />
    </svg>
  )
}
