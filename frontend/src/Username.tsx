import { useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError, createPlayer } from './api'
import { finishUsername } from './game'
import { getOnline, subscribeOnline } from './online'
import { setUsername } from './player'

const VALID = /^[A-Za-z0-9_]{3,16}$/

// First screen for a new player: pick a unique username so scores can be tracked.
export default function Username() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const online = useSyncExternalStore(subscribeOnline, getOnline)

  // No backend: skip the name and let them play.
  useEffect(() => {
    if (online === 'offline') finishUsername()
  }, [online])

  const submit = async () => {
    if (busy) return
    if (!VALID.test(name)) {
      setError('Use 3-16 letters, numbers or underscores.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const player = await createPlayer(name)
      setUsername(player.username)
      finishUsername()
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'That name is taken. Try another.'
          : e instanceof ApiError && e.status === 400
            ? 'Use 3-16 letters, numbers or underscores.'
            : 'Could not reach the server. Try again.',
      )
      setBusy(false)
    }
  }

  if (online !== 'online') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10, 6, 4, 0.7)',
          color: '#f1e6c8',
          font: '18px system-ui, sans-serif',
        }}
      >
        Connecting...
      </div>
    )
  }

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
        padding: 16,
        boxSizing: 'border-box',
        background: 'rgba(10, 6, 4, 0.7)',
        color: '#f1e6c8',
        font: '16px system-ui, sans-serif',
        textShadow: '0 2px 6px #000',
      }}
    >
      <div style={{ font: 'bold 56px Georgia, serif', color: '#f2c14e', letterSpacing: 3, textAlign: 'center' }}>
        Number Rush
      </div>
      <div style={{ fontSize: 18 }}>Pick a username to track your scores</div>
      <input
        autoFocus
        value={name}
        maxLength={16}
        placeholder="Username"
        onChange={(event) => {
          setName(event.target.value.trim())
          setError('')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        style={{
          width: 260,
          padding: '12px 16px',
          border: `2px solid ${error ? '#e5263f' : '#f2c14e'}`,
          borderRadius: 10,
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#f1e6c8',
          font: 'bold 22px system-ui, sans-serif',
          textAlign: 'center',
          outline: 'none',
        }}
      />
      <div style={{ minHeight: 20, fontSize: 14, color: '#ff8a8a' }}>{error}</div>
      <button
        onClick={submit}
        disabled={busy}
        style={{
          padding: '12px 48px',
          border: '2px solid #f2c14e',
          borderRadius: 10,
          background: '#8a5a1c',
          color: '#f1e6c8',
          font: 'bold 22px system-ui, sans-serif',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        Start
      </button>
      <div style={{ fontSize: 13, opacity: 0.7 }}>Letters, numbers and underscores. Names are unique.</div>
    </div>
  )
}
