import { useEffect, useSyncExternalStore } from 'react'
import { getScreen, goHome, restartGame, subscribeScreen } from './game'
import { getLives, subscribeLives } from './lives'

// Full-screen end screen shown once all lives are gone. The game freezes behind it until restart.
export default function GameOver() {
  const lives = useSyncExternalStore(subscribeLives, getLives)
  const screen = useSyncExternalStore(subscribeScreen, getScreen)
  const over = screen === 'playing' && lives === 0

  useEffect(() => {
    if (!over) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') restartGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over])

  if (!over) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: 'rgba(10, 6, 4, 0.78)',
        color: '#f1e6c8',
        font: '16px system-ui, sans-serif',
        textShadow: '0 2px 6px #000',
      }}
    >
      <div style={{ font: 'bold 64px Georgia, serif', color: '#e5263f', letterSpacing: 4 }}>GAME OVER</div>
      <div style={{ fontSize: 20 }}>The ships reached the shore.</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={restartGame}
          style={{
            padding: '12px 32px',
            border: '2px solid #f2c14e',
            borderRadius: 10,
            background: 'rgba(60, 44, 20, 0.9)',
            color: '#f1e6c8',
            font: 'bold 20px system-ui, sans-serif',
            cursor: 'pointer',
          }}
        >
          Play again
        </button>
        <button
          onClick={goHome}
          style={{
            padding: '12px 32px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 10,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#f1e6c8',
            font: 'bold 20px system-ui, sans-serif',
            cursor: 'pointer',
          }}
        >
          Home
        </button>
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>or press Enter to play again</div>
    </div>
  )
}
