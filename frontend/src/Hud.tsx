import { useEffect, useSyncExternalStore } from 'react'
import { goHome } from './game'
import { MAX_LIVES, getLives, subscribeLives } from './lives'

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

// Top-left HUD: remaining lives. The mode is picked on the home screen, so it is not shown here.
export default function Hud() {
  const lives = useSyncExternalStore(subscribeLives, getLives)
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
      </div>
      <ExitButton />
    </>
  )
}
