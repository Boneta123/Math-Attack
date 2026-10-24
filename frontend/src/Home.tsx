import { useEffect, useSyncExternalStore } from 'react'
import { beginCalibration } from './game'
import { getOperation, setOperation, subscribeOperation, type Operation } from './operations'

const MODES: { op: Operation; label: string; symbol: string }[] = [
  { op: '+', label: 'Addition', symbol: '+' },
  { op: '*', label: 'Multiplication', symbol: '×' },
]

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  color: '#f1e6c8',
  cursor: 'pointer',
  font: 'bold 18px system-ui, sans-serif',
}

// Start screen: pick a mode (the operation used to merge balls), then play.
export default function Home() {
  const mode = useSyncExternalStore(subscribeOperation, getOperation)

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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 14, letterSpacing: 2, opacity: 0.8 }}>MODE</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {MODES.map(({ op, label, symbol }) => {
            const active = op === mode
            return (
              <button
                key={op}
                onClick={() => setOperation(op)}
                style={{
                  ...buttonStyle,
                  padding: '10px 20px',
                  minWidth: 170,
                  background: active ? 'rgba(60, 44, 20, 0.9)' : 'rgba(0, 0, 0, 0.55)',
                  border: `2px solid ${active ? '#f2c14e' : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: active ? '0 0 12px rgba(242, 193, 78, 0.7)' : 'none',
                  opacity: active ? 1 : 0.75,
                }}
              >
                <span style={{ fontSize: 24, marginRight: 8 }}>{symbol}</span>
                {label}
              </button>
            )
          })}
        </div>
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
