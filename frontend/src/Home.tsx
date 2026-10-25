import { useEffect } from 'react'
import { beginCalibration } from './game'

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  color: '#f1e6c8',
  cursor: 'pointer',
  font: 'bold 18px system-ui, sans-serif',
}

// Start screen. There is one way to play: addition and multiplication together, switched in game.
export default function Home() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') beginCalibration()
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
        Merge balls with addition and multiplication. Close both fists to switch between them.
      </div>

      <button
        onClick={beginCalibration}
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
    </div>
  )
}
