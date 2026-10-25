import { useEffect, useState, useSyncExternalStore } from 'react'
import { chooseGameMode, goHome } from './game'
import Instructions from './Instructions'
import Leaderboard from './LeaderboardPopup'
import { getOnline, subscribeOnline } from './online'
import { getUsername, setAccount, subscribeUsername } from './player'

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  color: '#f1e6c8',
  cursor: 'pointer',
  font: 'bold 18px system-ui, sans-serif',
}

// Start screen. Play leads to the game mode picker, then the hand calibration.
export default function Home() {
  const [showHelp, setShowHelp] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const username = useSyncExternalStore(subscribeUsername, getUsername)
  const online = useSyncExternalStore(subscribeOnline, getOnline)

  // Enter plays; while the instructions or leaderboard are open, Enter or Escape closes them instead.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showHelp || showBoard) {
        if (event.key === 'Enter' || event.key === 'Escape') {
          setShowHelp(false)
          setShowBoard(false)
        }
      } else if (event.key === 'Enter') {
        chooseGameMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp, showBoard])

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
      {online === 'online' && (
        <button
          onClick={() => setShowBoard(true)}
          style={{
            ...buttonStyle,
            padding: '10px 28px',
            border: '2px solid rgba(255,255,255,0.3)',
            background: 'rgba(0, 0, 0, 0.55)',
          }}
        >
          Leaderboard
        </button>
      )}
      {online === 'online' && username && (
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          Playing as {username} ·{' '}
          <button
            onClick={() => {
              setAccount(null)
              goHome()
            }}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'inherit',
              font: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </div>
      )}
      {showHelp && <Instructions onClose={() => setShowHelp(false)} />}
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  )
}
