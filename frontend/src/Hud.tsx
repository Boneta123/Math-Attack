import { useSyncExternalStore } from 'react'
import { OPERATIONS, getOperation, subscribeOperation, type Operation } from './operations'

// Lives are display only for now: nothing takes them away yet.
const LIVES = 3

const LABELS: Record<Operation, string> = { '+': 'RH + LH', '*': 'RH × LH' }

function Heart() {
  return (
    <svg width="34" height="31" viewBox="0 0 32 29" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}>
      <path
        d="M16 28 C16 28 1 18 1 8.5 C1 4 4.5 1 8.5 1 C11.7 1 14.5 2.8 16 5.6 C17.5 2.8 20.3 1 23.5 1 C27.5 1 31 4 31 8.5 C31 18 16 28 16 28 Z"
        fill="#e5263f"
        stroke="#7a0f1f"
        strokeWidth="1.5"
      />
    </svg>
  )
}

// Top-left HUD: lives above a small inventory of the three operations.
export default function Hud() {
  const selected = useSyncExternalStore(subscribeOperation, getOperation)
  return (
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {Array.from({ length: LIVES }, (_, i) => (
          <Heart key={i} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 124 }}>
        {OPERATIONS.map((op) => {
          const active = op === selected
          return (
            <div
              key={op}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: active ? 'rgba(60, 44, 20, 0.85)' : 'rgba(0, 0, 0, 0.55)',
                border: `2px solid ${active ? '#f2c14e' : 'rgba(255,255,255,0.18)'}`,
                boxShadow: active ? '0 0 10px rgba(242, 193, 78, 0.7)' : 'none',
                opacity: active ? 1 : 0.7,
                fontWeight: active ? 700 : 500,
              }}
            >
              {LABELS[op]}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, textShadow: '0 1px 3px #000' }}>Close both fists to switch</div>
    </div>
  )
}
