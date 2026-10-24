import { useEffect, useRef, useState } from 'react'
import { BALL_ROW_Y } from './cannons'
import { goHome, startGame } from './game'
import { displayToScreen, handAnchors, type HandAnchors } from './handTracking'

// Before a game: two hand outlines show where to hold the hands and how big they should look, which
// sets how far from the camera to stand. Holding both hands in the outlines for HOLD_SECONDS starts the game.

const HOLD_SECONDS = 3
// A short tracking blip does not reset the countdown; being out of place for longer than this does.
const GRACE_MS = 250
// Target palm length (wrist to middle knuckle) as a fraction of a grid column (screen width / 6),
// and how far off the hand may be: size within SIZE_TOLERANCE either way, palm center within
// POSITION_TOLERANCE palm lengths of the outline's palm.
const PALM_CELLS = 0.55
const SIZE_TOLERANCE = 0.35
const POSITION_TOLERANCE = 0.9
// Outline palm centers in normalized screen space: either side of the hand zone, on the ball row.
const TARGETS = { left: { x: 0.3, y: BALL_ROW_Y }, right: { x: 0.7, y: BALL_ROW_Y } }

// Outline geometry in a 100 x 140 box: a right hand seen in the mirrored camera view (palm to the
// camera, thumb toward the middle of the screen). PALM_UNITS is its wrist to middle knuckle length
// and PALM_CENTER where MediaPipe's palm center (mean of wrist and knuckles) falls on it. MediaPipe's
// wrist point is where the palm meets the wrist (y = 118 here), not the bottom of the drawn wrist.
const PALM_UNITS = 50
const PALM_CENTER = { x: 51, y: 80 }
const WRIST = 0
const MIDDLE_MCP = 9

type Status = 'missing' | 'closer' | 'back' | 'move' | 'ok'

const MESSAGES: Record<Exclude<Status, 'ok'>, string> = {
  missing: 'Show this hand',
  closer: 'Move closer',
  back: 'Move back',
  move: 'Line it up',
}

function handStatus(hand: HandAnchors | undefined, key: 'left' | 'right', cw: number, ch: number): Status {
  if (!hand) return 'missing'
  const target = cw / 6 * PALM_CELLS
  const wrist = displayToScreen(hand.landmarks[WRIST], cw, ch)
  const knuckle = displayToScreen(hand.landmarks[MIDDLE_MCP], cw, ch)
  const ratio = Math.hypot(knuckle.x - wrist.x, knuckle.y - wrist.y) / target
  if (ratio < 1 - SIZE_TOLERANCE) return 'closer'
  if (ratio > 1 + SIZE_TOLERANCE) return 'back'
  const palm = displayToScreen(hand.palm, cw, ch)
  const goal = TARGETS[key]
  if (Math.hypot(palm.x - goal.x * cw, palm.y - goal.y * ch) > POSITION_TOLERANCE * target) return 'move'
  return 'ok'
}

function HandOutline({ side, status, cw }: { side: 'left' | 'right'; status: Status; cw: number }) {
  const scale = (cw / 6) * PALM_CELLS / PALM_UNITS
  const goal = TARGETS[side]
  const color = status === 'ok' ? '#3dff7a' : '#f1e6c8'
  const maskId = `hand-outline-${side}`
  const shapes = (
    <>
      <rect x="22" y="62" width="56" height="60" rx="16" />
      <rect x="32" y="108" width="36" height="30" rx="8" />
      <rect x="22" y="22" width="14" height="50" rx="7" />
      <rect x="37" y="12" width="14" height="58" rx="7" />
      <rect x="52" y="18" width="14" height="52" rx="7" />
      <rect x="66" y="34" width="12" height="40" rx="6" />
      <rect x="6" y="66" width="14" height="42" rx="7" transform="rotate(-35 20 108)" />
    </>
  )
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(${goal.x * 100}% - ${PALM_CENTER.x * scale}px)`,
        top: `calc(${goal.y * 100}% - ${PALM_CENTER.y * scale}px)`,
        width: 100 * scale,
        height: 140 * scale,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 140" style={{ overflow: 'visible' }}>
        <defs>
          <mask id={maskId}>
            <g fill="white" stroke="white" strokeWidth="5">
              {shapes}
            </g>
            <g fill="black">{shapes}</g>
          </mask>
        </defs>
        <g transform={side === 'left' ? 'translate(100 0) scale(-1 1)' : undefined}>
          <g fill={color} opacity={status === 'ok' ? 0.25 : 0.1}>
            {shapes}
          </g>
          <rect x="-10" y="-10" width="120" height="160" fill={color} mask={`url(#${maskId})`} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6,
          whiteSpace: 'nowrap',
          color,
          font: 'bold 16px system-ui, sans-serif',
          textShadow: '0 1px 4px #000',
        }}
      >
        {status === 'ok' ? 'Good' : MESSAGES[status]}
      </div>
    </div>
  )
}

// Shown between the home screen and the game.
export default function Calibration() {
  const root = useRef<HTMLDivElement>(null)
  const [statuses, setStatuses] = useState<{ left: Status; right: Status }>({ left: 'missing', right: 'missing' })
  const [held, setHeld] = useState(0)
  const [width, setWidth] = useState(() => window.innerWidth)
  // Where each tracked palm center lands on screen, so players can see what has to go in the ring.
  const [palms, setPalms] = useState<{ x: number; y: number }[]>([])

  useEffect(() => {
    let raf = 0
    let alignedSince: number | null = null
    let lastAligned = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      if (!el) return
      const cw = el.clientWidth
      const ch = el.clientHeight
      // Match hands to outlines by where they are on screen rather than by MediaPipe's left/right
      // label, which can swap: with two hands the leftmost takes the left outline, and a lone hand
      // takes whichever outline it is nearer.
      const hands = [handAnchors.left, handAnchors.right]
        .filter((h) => h.present && h.landmarks.length > MIDDLE_MCP)
        .sort((a, b) => a.palm.x - b.palm.x)
      const leftHand = hands.length === 2 ? hands[0] : hands.find((h) => h.palm.x < 0.5)
      const rightHand = hands.length === 2 ? hands[1] : hands.find((h) => h.palm.x >= 0.5)
      const left = handStatus(leftHand, 'left', cw, ch)
      const right = handStatus(rightHand, 'right', cw, ch)
      setWidth(cw)
      setPalms(hands.map((h) => displayToScreen(h.palm, cw, ch)))
      setStatuses((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))

      if (left === 'ok' && right === 'ok') {
        alignedSince ??= now
        lastAligned = now
      } else if (alignedSince !== null && now - lastAligned > GRACE_MS) {
        alignedSince = null
      }
      const seconds = alignedSince === null ? 0 : (now - alignedSince) / 1000
      setHeld(seconds)
      if (seconds >= HOLD_SECONDS) {
        cancelAnimationFrame(raf)
        startGame()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const counting = held > 0
  const ready = statuses.left === 'ok' && statuses.right === 'ok'

  return (
    <div
      ref={root}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'rgba(10, 6, 4, 0.45)',
        color: '#f1e6c8',
        font: '16px system-ui, sans-serif',
        textShadow: '0 2px 6px #000',
      }}
    >
      <div style={{ position: 'absolute', top: '10%', left: 16, right: 16, textAlign: 'center' }}>
        <div style={{ font: 'bold 36px Georgia, serif', color: '#f2c14e' }}>Get in position</div>
        <div style={{ marginTop: 10, fontSize: 18 }}>
          Hold both hands open inside the outlines, palms to the camera.
          <br />
          Step closer or farther until each hand fills its outline.
        </div>
        <div style={{ marginTop: 18, font: 'bold 44px system-ui, sans-serif', color: ready ? '#3dff7a' : '#f1e6c8' }}>
          {counting ? Math.max(1, Math.ceil(HOLD_SECONDS - held)) : ' '}
        </div>
        <div
          style={{
            margin: '8px auto 0',
            width: 'min(320px, 80%)',
            height: 8,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${Math.min(held / HOLD_SECONDS, 1) * 100}%`, height: '100%', background: '#3dff7a' }} />
        </div>
      </div>

      <HandOutline side="left" status={statuses.left} cw={width} />
      <HandOutline side="right" status={statuses.right} cw={width} />
      {(['left', 'right'] as const).map((side) => {
        const radius = POSITION_TOLERANCE * (width / 6) * PALM_CELLS
        return (
          <div
            key={side}
            style={{
              position: 'absolute',
              left: `calc(${TARGETS[side].x * 100}% - ${radius}px)`,
              top: `calc(${TARGETS[side].y * 100}% - ${radius}px)`,
              width: radius * 2,
              height: radius * 2,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `2px dashed ${statuses[side] === 'ok' ? '#3dff7a' : 'rgba(241, 230, 200, 0.5)'}`,
            }}
          />
        )
      })}
      {palms.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x - 7,
            top: p.y - 7,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#f2c14e',
            border: '2px solid #000',
          }}
        />
      ))}

      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 10 }}>
        <button onClick={goHome} style={smallButton}>
          Back
        </button>
        <button onClick={startGame} style={smallButton}>
          Skip
        </button>
      </div>
    </div>
  )
}

const smallButton: React.CSSProperties = {
  padding: '8px 18px',
  border: '2px solid rgba(255,255,255,0.3)',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.55)',
  color: '#f1e6c8',
  font: 'bold 15px system-ui, sans-serif',
  cursor: 'pointer',
}
