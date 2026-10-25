import { useEffect } from 'react'
import { beginCalibration, goHome } from './game'
import { GAME_MODES, setGameMode, type GameModeId } from './gameMode'

const SYMBOLS = { '+': '+', '-': '−', '*': '×' } as const

// Shown after Play and before the hand calibration: pick one of the game modes.
export default function ModeSelect() {
  const pick = (id: GameModeId) => {
    setGameMode(id)
    beginCalibration()
  }

  // 1, 2, 3 pick a mode; Escape goes back to the home screen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (index >= 0 && index < GAME_MODES.length) pick(GAME_MODES[index].id)
      else if (event.key === 'Escape') goHome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
        gap: 24,
        padding: 16,
        boxSizing: 'border-box',
        overflowY: 'auto',
        background: 'rgba(10, 6, 4, 0.7)',
        color: '#f1e6c8',
        font: '16px system-ui, sans-serif',
        textShadow: '0 2px 6px #000',
      }}
    >
      <div style={{ font: 'bold 44px Georgia, serif', color: '#f2c14e', textAlign: 'center' }}>Choose a game mode</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {GAME_MODES.map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => pick(mode.id)}
            style={{
              width: 230,
              padding: '20px 18px',
              borderRadius: 14,
              border: '2px solid #f2c14e',
              background: 'rgba(40, 28, 14, 0.9)',
              color: '#f1e6c8',
              cursor: 'pointer',
              textAlign: 'center',
              font: '15px system-ui, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7 }}>MODE {i + 1}</div>
            <div style={{ font: 'bold 24px system-ui, sans-serif' }}>{mode.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {mode.operations.map((op) => (
                <span
                  key={op}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: '#8a5a1c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: 'bold 28px system-ui, sans-serif',
                  }}
                >
                  {SYMBOLS[op]}
                </span>
              ))}
            </div>
            <div style={{ lineHeight: 1.4, opacity: 0.9 }}>{mode.description}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, opacity: 0.7 }}>Click a mode or press 1, 2 or 3</div>
      <button
        onClick={goHome}
        style={{
          padding: '8px 22px',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#f1e6c8',
          font: 'bold 15px system-ui, sans-serif',
          cursor: 'pointer',
        }}
      >
        Back
      </button>
    </div>
  )
}
