import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Entry } from './api'
import { GAME_MODES, type GameModeId } from './gameMode'
import { getBoard, refreshBoard, subscribeBoards } from './leaderboard'
import { getUsername, subscribeUsername } from './player'

// One ranked list of scores. The player's own name is highlighted in the overall list.
export function ScoreList({
  entries,
  limit,
  size = 15,
  empty = 'No scores yet',
}: {
  entries: Entry[]
  limit: number
  size?: number
  empty?: string
}) {
  const me = useSyncExternalStore(subscribeUsername, getUsername)
  if (entries.length === 0) return <div style={{ fontSize: size, opacity: 0.6 }}>{empty}</div>
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: size }}>
      {entries.slice(0, limit).map((entry, i) => {
        const mine = entry.username.toLowerCase() === me?.toLowerCase()
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              padding: '2px 0',
              color: mine ? '#f2c14e' : undefined,
              fontWeight: mine ? 'bold' : undefined,
            }}
          >
            <span style={{ width: '1.8em', opacity: 0.6 }}>{i + 1}.</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.username}</span>
            <span>{entry.score}</span>
          </li>
        )
      })}
    </ol>
  )
}

const heading: React.CSSProperties = { font: 'bold 16px system-ui, sans-serif', color: '#f2c14e', marginBottom: 6 }

// Popup opened from the home screen: a tab per game mode with the overall top 25 and the player's top 10.
export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<GameModeId>(GAME_MODES[0].id)
  const board = useSyncExternalStore(subscribeBoards, () => getBoard(mode))

  useEffect(() => {
    void refreshBoard(mode)
  }, [mode])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 640,
          maxWidth: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: 24,
          borderRadius: 14,
          border: '2px solid #f2c14e',
          background: 'rgba(30, 20, 10, 0.97)',
          color: '#f1e6c8',
          font: '16px system-ui, sans-serif',
          textAlign: 'left',
        }}
      >
        <div style={{ font: 'bold 30px Georgia, serif', color: '#f2c14e', marginBottom: 14 }}>Leaderboard</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {GAME_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                padding: '8px 16px',
                border: `2px solid ${m.id === mode ? '#f2c14e' : 'rgba(255,255,255,0.3)'}`,
                borderRadius: 8,
                background: m.id === mode ? '#8a5a1c' : 'rgba(0, 0, 0, 0.5)',
                color: '#f1e6c8',
                font: 'bold 15px system-ui, sans-serif',
                cursor: 'pointer',
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <div style={heading}>Overall top 25</div>
            <ScoreList entries={board.overall} limit={25} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <div style={heading}>Your top 10</div>
            <ScoreList entries={board.mine} limit={10} empty="Play a round to set a score" />
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            padding: '8px 24px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#f1e6c8',
            font: 'bold 15px system-ui, sans-serif',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
