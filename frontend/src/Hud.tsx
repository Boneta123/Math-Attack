import { useEffect, useSyncExternalStore } from 'react'
import { goHome } from './game'
import { MAX_LIVES, getLives, subscribeLives } from './lives'
import { getScore, subscribeScore } from './score'
import { OPERATIONS, getOperation, subscribeOperation, type Operation } from './operations'

const SYMBOLS: Record<Operation, { symbol: string; label: string }> = {
  '+': { symbol: '+', label: 'Add' },
  '-': { symbol: '−', label: 'Subtract' },
  '*': { symbol: '×', label: 'Multiply' },
}

function Heart({ lost }: { lost: boolean }) {
  return (
    <svg
      width="34"
      height="31"
      viewBox="0 0 32 29"
      style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))', opacity: lost ? 0.25 : 1 }}
    >
      <path
        d="M16 28 C16 28 1 18 1 8.5 C1 4 4.5 1 8.5 1 C11.7 1 14.5 2.8 16 5.6 C17.5 2.8 20.3 1 23.5 1 C27.5 1 31 4 31 8.5 C31 18 16 28 16 28 Z"
        fill="#e5263f"
        stroke="#7a0f1f"
        strokeWidth="1.5"
      />
    </svg>
  )
}

// Top-right button that leaves the game for the home screen (Escape does the same).
function ExitButton() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') goHome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <button
      onClick={goHome}
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 12,
        padding: '8px 18px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#f1e6c8',
        font: 'bold 15px system-ui, sans-serif',
        cursor: 'pointer',
      }}
    >
      Exit
    </button>
  )
}

// Three large boxes under the Exit button showing the current mode. They are not selectable: stretch
// out either thumb to move to the next one.
function ModeDisplay() {
  const selected = useSyncExternalStore(subscribeOperation, getOperation)
  return (
    <div
      style={{
        position: 'absolute',
        top: 66,
        right: 14,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 164,
        pointerEvents: 'none',
      }}
    >
      {OPERATIONS.map((op) => {
        const active = op === selected
        return (
          <div
            key={op}
            style={{
              height: 80,
              border: `3px solid ${active ? '#f2c14e' : 'rgba(255,255,255,0.3)'}`,
              borderRadius: 12,
              background: active ? 'rgba(88, 62, 22, 0.92)' : 'rgba(0, 0, 0, 0.6)',
              boxShadow: active ? '0 0 16px rgba(242, 193, 78, 0.8)' : 'none',
              opacity: active ? 1 : 0.7,
              color: '#f1e6c8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              font: 'bold 18px system-ui, sans-serif',
            }}
          >
            <span style={{ fontSize: 44, lineHeight: 1 }}>{SYMBOLS[op].symbol}</span>
            <span style={{ fontSize: 16, opacity: 0.9 }}>{SYMBOLS[op].label}</span>
          </div>
        )
      })}
      <div style={{ font: '13px system-ui, sans-serif', textAlign: 'center', opacity: 0.85, color: '#f1e6c8', textShadow: '0 1px 3px #000' }}>
        Stretch out a thumb to switch
      </div>
    </div>
  )
}

// Top-left HUD: remaining lives with the score under them. The mode display and Exit are on the right.
export default function Hud() {
  const lives = useSyncExternalStore(subscribeLives, getLives)
  const score = useSyncExternalStore(subscribeScore, getScore)
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 12,
          pointerEvents: 'none',
          font: '14px system-ui, sans-serif',
          color: '#f1e6c8',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart key={i} lost={i >= lives} />
          ))}
        </div>
        <div style={{ marginTop: 8, font: 'bold 26px system-ui, sans-serif', textShadow: '0 2px 4px #000' }}>
          Score: {score}
        </div>
      </div>
      <ModeDisplay />
      <ExitButton />
    </>
  )
}
