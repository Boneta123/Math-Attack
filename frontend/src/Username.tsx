import { useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError, createPlayer, login } from './api'
import { finishUsername } from './game'
import { getOnline, subscribeOnline } from './online'
import { setAccount } from './player'

const VALID_NAME = /^[A-Za-z0-9_]{3,16}$/
const NAME_HELP = 'Use 3-16 letters, numbers or underscores.'

const inputStyle: React.CSSProperties = {
  width: 260,
  padding: '12px 16px',
  borderRadius: 10,
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#f1e6c8',
  font: 'bold 20px system-ui, sans-serif',
  textAlign: 'center',
  outline: 'none',
}

// Eye button inside the password box: touch it to show the password, again to hide it. Pressing it
// does not take focus from the input, so the keyboard stays up on phones.
function EyeButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseDown={(event) => event.preventDefault()}
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      style={{
        position: 'absolute',
        top: '50%',
        right: 8,
        transform: 'translateY(-50%)',
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 8,
        background: 'none',
        color: shown ? '#f2c14e' : '#f1e6c8',
        cursor: 'pointer',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
        {shown && <path d="M3 3l18 18" />}
      </svg>
    </button>
  )
}

// First screen for a new player: sign up with a unique username and a password, or log in to an
// existing account, so scores can be tracked.
export default function Username() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const online = useSyncExternalStore(subscribeOnline, getOnline)

  // No backend: skip the account and let them play.
  useEffect(() => {
    if (online === 'offline') finishUsername()
  }, [online])

  const submit = async () => {
    if (busy) return
    if (!VALID_NAME.test(name)) return setError(NAME_HELP)
    if (mode === 'signup' && (password.length < 8 || password.length > 72)) {
      return setError('Password must be 8-72 characters.')
    }
    setBusy(true)
    setError('')
    try {
      const player = await (mode === 'signup' ? createPlayer : login)(name, password)
      setAccount({ username: player.username, password })
      finishUsername()
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0
      setError(
        status === 409
          ? 'That name is taken. Try another, or log in.'
          : status === 401
            ? 'Wrong username or password.'
            : status === 400
              ? mode === 'signup'
                ? 'Use a 3-16 character name and an 8-72 character password.'
                : NAME_HELP
              : 'Could not reach the server. Try again.',
      )
      setBusy(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'signup' ? 'login' : 'signup')
    setError('')
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

  const border = `2px solid ${error ? '#e5263f' : '#f2c14e'}`
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') submit()
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
        gap: 16,
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
      <div style={{ fontSize: 18 }}>
        {mode === 'signup' ? 'Create an account to track your scores' : 'Log in to your account'}
      </div>
      <input
        autoFocus
        value={name}
        maxLength={16}
        placeholder="Username"
        autoComplete="username"
        onChange={(event) => {
          setName(event.target.value.trim())
          setError('')
        }}
        onKeyDown={onKeyDown}
        style={{ ...inputStyle, border }}
      />
      <div style={{ position: 'relative' }}>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          maxLength={72}
          placeholder="Password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          onChange={(event) => {
            setPassword(event.target.value)
            setError('')
          }}
          onKeyDown={onKeyDown}
          style={{ ...inputStyle, border, paddingRight: 52 }}
        />
        <EyeButton shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
      </div>
      <div style={{ minHeight: 20, fontSize: 14, color: '#ff8a8a', textAlign: 'center' }}>{error}</div>
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
        {mode === 'signup' ? 'Sign up' : 'Log in'}
      </button>
      <button
        onClick={switchMode}
        style={{
          border: 'none',
          background: 'none',
          color: '#f1e6c8',
          font: '15px system-ui, sans-serif',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Sign up'}
      </button>
    </div>
  )
}
