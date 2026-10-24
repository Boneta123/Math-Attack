import './beach.css'
import type { CSSProperties } from 'react'
import { NoiseTexture } from './effects/NoiseTexture'
import { Particles } from './effects/Particles'
import { Ripple } from './effects/Ripple'

// The hand zone (bottom third) is the sand; the rest is water. Matches the divider in App.tsx.
const SAND_HEIGHT = '33.333%'
const WATER_HEIGHT = '66.667%'

const layer: CSSProperties = { position: 'absolute', pointerEvents: 'none' }
const WRECK = '#15110e'

// Repeating wave line used as a scrolling background (period 240px, matches bs-wave).
const waveUrl = (amp: number, stroke: string) => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='${amp * 2 + 4}' viewBox='0 0 240 ${amp * 2 + 4}'>` +
    `<path d='M0 ${amp + 2} Q60 2 120 ${amp + 2} T240 ${amp + 2}' fill='none' stroke='${stroke}' stroke-width='2'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const WAVES = [
  { top: '14%', amp: 5, stroke: 'rgba(190,210,215,0.22)', duration: 26 },
  { top: '30%', amp: 7, stroke: 'rgba(190,210,215,0.18)', duration: 20 },
  { top: '48%', amp: 9, stroke: 'rgba(190,210,215,0.16)', duration: 15 },
  { top: '66%', amp: 11, stroke: 'rgba(210,225,228,0.2)', duration: 11 },
  { top: '84%', amp: 12, stroke: 'rgba(210,225,228,0.24)', duration: 8 },
]

// Small dark silhouette of an invading ship on the horizon.
function Ship({ left, top, width, delay }: { left: string; top: string; width: number; delay: number }) {
  return (
    <svg
      className="bs-bob"
      viewBox="0 0 100 70"
      style={{ ...layer, left, top, width, opacity: 0.8, animationDelay: `${delay}s` }}
    >
      <path d="M5 50 L95 50 L82 64 L18 64 Z" fill="#0b1317" />
      <rect x="30" y="8" width="2.5" height="42" fill="#0b1317" />
      <rect x="62" y="14" width="2.5" height="36" fill="#0b1317" />
      <path d="M34 10 L34 44 L56 44 Z" fill="#0b1317" />
      <path d="M66 16 L66 44 L84 44 Z" fill="#0b1317" />
      <path d="M95 50 L108 44" stroke="#0b1317" strokeWidth="2" />
    </svg>
  )
}

// Left corner: ribs of a broken hull and a snapped mast with torn rigging.
function HullWreck() {
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMinYMax meet"
      style={{ ...layer, left: 0, bottom: 0, width: '13%', height: '30%', opacity: 0.8 }}
    >
      <g stroke={WRECK} strokeWidth="8" strokeLinecap="round" fill="none">
        <path d="M10 192 L150 192" strokeWidth="10" />
        <path d="M22 190 Q8 130 56 84" />
        <path d="M52 190 Q40 136 84 98" />
        <path d="M82 190 Q74 142 112 112" />
        <path d="M112 190 Q108 150 138 130" />
        <path d="M140 192 L118 54" strokeWidth="7" />
        <path d="M118 54 L126 44" strokeWidth="5" />
      </g>
      <g stroke={WRECK} strokeWidth="1.6" fill="none" opacity="0.8">
        <path d="M121 70 Q80 90 56 84" />
        <path d="M122 90 Q150 120 170 150" />
      </g>
      <path d="M121 62 L96 80 L112 84 L104 102 L122 96 Z" fill={WRECK} opacity="0.7" />
    </svg>
  )
}

// Right corner: half-buried anchor, a barrel and loose planks.
function DebrisWreck() {
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMaxYMax meet"
      style={{ ...layer, right: 0, bottom: 0, width: '13%', height: '30%', opacity: 0.8 }}
    >
      <g stroke={WRECK} strokeWidth="7" strokeLinecap="round" fill="none">
        <circle cx="70" cy="58" r="12" />
        <path d="M70 70 L70 172" />
        <path d="M46 88 L94 88" />
        <path d="M34 150 Q70 198 106 150" />
      </g>
      <g fill={WRECK}>
        <rect x="128" y="140" width="42" height="50" rx="8" />
        <rect x="96" y="184" width="86" height="8" rx="3" transform="rotate(-6 96 184)" />
        <rect x="150" y="176" width="46" height="7" rx="3" transform="rotate(10 150 176)" />
      </g>
      <g stroke="#3a3128" strokeWidth="2">
        <path d="M128 156 L170 156" />
        <path d="M128 174 L170 174" />
      </g>
    </svg>
  )
}

// A hull section sinking at the left edge of the water.
function SinkingHull() {
  return (
    <svg
      viewBox="0 0 120 80"
      preserveAspectRatio="xMinYMid meet"
      style={{ ...layer, left: 0, top: '44%', width: '11%', opacity: 0.5 }}
    >
      <path d="M0 22 L78 22 Q108 44 70 66 L0 66 Z" fill={WRECK} />
      <path d="M14 22 L14 6 M40 22 L40 10" stroke={WRECK} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function BeachScene() {
  // Everything here is translucent so the webcam feed stays visible underneath.
  return (
    <div style={{ ...layer, inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Water zone */}
      <div
        style={{
          ...layer,
          top: 0,
          left: 0,
          right: 0,
          height: WATER_HEIGHT,
          // Pale overcast haze at the horizon so the dark ship silhouettes read, darker stormy water below.
          background:
            'linear-gradient(to bottom, rgba(120,138,146,0.5) 0%, rgba(60,82,90,0.5) 18%, rgba(14,30,38,0.6) 60%, rgba(30,58,66,0.42) 100%)',
          overflow: 'hidden',
        }}
      >
        {WAVES.map((w) => (
          <div
            key={w.top}
            className="bs-wave"
            style={{
              top: w.top,
              height: w.amp * 2 + 4,
              backgroundImage: waveUrl(w.amp, w.stroke),
              animationDuration: `${w.duration}s`,
            }}
          />
        ))}
        <Ripple mainCircleSize={150} mainCircleOpacity={0.16} numCircles={4} color="#b8ccd2" style={{ left: '-8%', top: '12%' }} />
        <Ripple mainCircleSize={170} mainCircleOpacity={0.14} numCircles={4} color="#b8ccd2" style={{ left: '78%', top: '28%' }} />
        <Ship left="6%" top="3%" width={70} delay={0} />
        <Ship left="30%" top="5%" width={52} delay={1.4} />
        <Ship left="64%" top="2%" width={62} delay={2.6} />
        <Ship left="88%" top="6%" width={46} delay={0.8} />
        <SinkingHull />
      </div>

      {/* Sand zone: the hand zone */}
      <div
        style={{
          ...layer,
          bottom: 0,
          left: 0,
          right: 0,
          height: SAND_HEIGHT,
          background: 'linear-gradient(to bottom, rgba(125,102,68,0.42), rgba(72,58,40,0.55))',
          overflow: 'hidden',
        }}
      >
        <NoiseTexture frequency={0.85} octaves={3} slope={0.9} noiseOpacity={0.5} style={{ mixBlendMode: 'overlay' }} />
      </div>

      {/* Wet shoreline between water and sand */}
      <svg
        viewBox="0 0 1200 24"
        preserveAspectRatio="none"
        style={{ ...layer, left: 0, right: 0, bottom: SAND_HEIGHT, width: '100%', height: 24 }}
      >
        <path
          d="M0 12 Q75 0 150 12 T300 12 T450 12 T600 12 T750 12 T900 12 T1050 12 T1200 12 L1200 24 L0 24 Z"
          fill="rgba(58,48,36,0.45)"
        />
        <path
          className="bs-foam"
          d="M0 12 Q75 0 150 12 T300 12 T450 12 T600 12 T750 12 T900 12 T1050 12 T1200 12"
          fill="none"
          stroke="rgba(214,222,224,0.75)"
          strokeWidth="3"
        />
      </svg>

      <HullWreck />
      <DebrisWreck />

      {/* Fog banks and drifting mist */}
      <div
        className="bs-fog"
        style={{ left: '-10%', bottom: '24%', width: '60%', height: '22%', background: 'radial-gradient(closest-side, rgba(205,215,220,0.2), transparent)' }}
      />
      <div
        className="bs-fog"
        style={{ right: '-12%', bottom: '38%', width: '55%', height: '20%', background: 'radial-gradient(closest-side, rgba(205,215,220,0.16), transparent)', animationDuration: '36s' }}
      />
      <div
        className="bs-fog"
        style={{ left: '20%', top: '8%', width: '60%', height: '18%', background: 'radial-gradient(closest-side, rgba(190,205,212,0.14), transparent)', animationDuration: '44s' }}
      />
      <Particles quantity={50} size={1.4} color="#d5dde0" vx={0.18} vy={0.02} />

      {/* Overcast vignette */}
      <div
        style={{
          ...layer,
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%), rgba(60,75,85,0.1)',
        }}
      />
    </div>
  )
}
