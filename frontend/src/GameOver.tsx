import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getScreen, goHome, restartGame, subscribeScreen } from './game'
import { getGameMode } from './gameMode'
import { submitRun, type RunResult } from './leaderboard'
import { getLives, subscribeLives } from './lives'
import { getScore, subscribeScore } from './score'

const RESULT_TEXT: Record<RunResult, string> = {
  none: '',
  top10: 'New top-10 score!',
  leaderboard: 'You made the overall leaderboard!',
  offline: 'Could not save your score right now.',
}

// Sends the finished run to the backend when the end screen appears, then shows how it went. It only
// exists while the end screen is up, so each run submits once (the ref covers dev double-mounting).
function RunResultLine() {
  const [result, setResult] = useState<RunResult | null>(null)
  const submitted = useRef(false)
  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    submitRun(getGameMode().id, getScore()).then(setResult)
  }, [])
  return <div style={{ minHeight: 22, fontSize: 18 }}>{result && RESULT_TEXT[result]}</div>
}

// Full-screen end screen shown once all lives are gone. The game freezes behind it until restart.
export default function GameOver() {
  const lives = useSyncExternalStore(subscribeLives, getLives)
  const score = useSyncExternalStore(subscribeScore, getScore)
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
      <div style={{ font: 'bold 36px system-ui, sans-serif', color: '#f2c14e' }}>Score: {score}</div>
      <RunResultLine />
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
