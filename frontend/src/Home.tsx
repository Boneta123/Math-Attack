import { useEffect, useState } from 'react'
import { chooseGameMode } from './game'
import Instructions from './Instructions'

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  color: '#f1e6c8',
  cursor: 'pointer',
  font: 'bold 18px system-ui, sans-serif',
}

// Start screen. Play leads to the game mode picker, then the hand calibration.
export default function Home() {
  const [showHelp, setShowHelp] = useState(false)

  // Enter plays; while the instructions are open, Enter or Escape closes them instead.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showHelp) {
        if (event.key === 'Enter' || event.key === 'Escape') setShowHelp(false)
      } else if (event.key === 'Enter') {
        chooseGameMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp])

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
        gap: 28,
        padding: 16,
        boxSizing: 'border-box',
        background: 'rgba(10, 6, 4, 0.7)',
        color: '#f1e6c8',
        font: '16px system-ui, sans-serif',
        textShadow: '0 2px 6px #000',
      }}
    >
      <div style={{ font: 'bold 68px Georgia, serif', color: '#f2c14e', letterSpacing: 3, textAlign: 'center' }}>
        Number Rush
      </div>

      <div style={{ fontSize: 15, opacity: 0.85, textAlign: 'center', maxWidth: 420, lineHeight: 1.5 }}>
        Merge balls to match the numbers on the ships and sink them before they reach the shore.
      </div>

      <button
        onClick={chooseGameMode}
        style={{
          ...buttonStyle,
          padding: '14px 56px',
          border: '2px solid #f2c14e',
          background: '#8a5a1c',
          font: 'bold 26px system-ui, sans-serif',
        }}
      >
        Play
      </button>
      <div style={{ fontSize: 13, opacity: 0.7, marginTop: -16 }}>or press Enter</div>
      <button
        onClick={() => setShowHelp(true)}
        style={{
          ...buttonStyle,
          padding: '10px 28px',
          border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(0, 0, 0, 0.55)',
        }}
      >
        How to play
      </button>
      {showHelp && <Instructions onClose={() => setShowHelp(false)} />}
    </div>
  )
}
