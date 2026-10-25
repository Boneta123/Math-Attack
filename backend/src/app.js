import cors from 'cors'
import express from 'express'
import { hashPassword, verifyPassword } from './password.js'

const MODES = ['addition', 'mixed', 'challenge']
const USERNAME = /^[A-Za-z0-9_]{3,16}$/
const MAX_SCORE = 1_000_000

// Postgres error codes raised by schema.sql and the unique index.
const UNIQUE_VIOLATION = '23505'
const UNKNOWN_PLAYER = 'P0002'
const BAD_INPUT = '22023'

const validMode = (mode) => MODES.includes(mode)
const validUsername = (name) => typeof name === 'string' && USERNAME.test(name)
const validScore = (score) => Number.isInteger(score) && score >= 1 && score <= MAX_SCORE
const validPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 72

// Reads `Authorization: Basic base64(username:password)`. Splits on the first colon only, since a
// password may contain colons.
function parseBasic(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const split = decoded.indexOf(':')
  if (split < 1) return null
  return { username: decoded.slice(0, split), password: decoded.slice(split + 1) }
}

// Wraps one row of `scores_*` / `leaderboard_*` joined with its player into the shape the game uses.
const toEntry = (row) => ({ username: row.players.username, score: row.score })

// Builds the API around a Supabase client, so tests can pass in a fake one.
export function createApp(supabase, { frontendOrigin = 'http://localhost:5173' } = {}) {
  const app = express()
  app.use(cors({ origin: frontendOrigin }))
  app.use(express.json({ limit: '1kb' }))

  // Maps a database error to a response; anything unexpected is a 500 without leaking details.
  const fail = (res, error) => {
    if (error.code === UNIQUE_VIOLATION) return res.status(409).json({ error: 'Username already taken' })
    if (error.code === UNKNOWN_PLAYER) return res.status(404).json({ error: 'Unknown player' })
    if (error.code === BAD_INPUT) return res.status(400).json({ error: 'Invalid request' })
    console.error(error)
    return res.status(500).json({ error: 'Server error' })
  }

  // The game calls this once on load; if it fails, the game runs without usernames or leaderboards.
  app.get('/api/health', async (_req, res) => {
    const { error } = await supabase.from('players').select('id').limit(1)
    if (error) return res.status(503).json({ ok: false })
    res.json({ ok: true })
  })

  // Checks a username and password against the stored hash. Returns the stored username, or null for a
  // wrong password or an unknown user (the work done is the same, so timing does not tell them apart).
  const authenticate = async (username, password) => {
    if (!validUsername(username) || typeof password !== 'string') return null
    const { data, error } = await supabase
      .from('players')
      .select('username, password_hash')
      // `_` is a LIKE wildcard, so escape it to match the username exactly (ignoring case).
      .ilike('username', username.replaceAll('_', '\\_'))
      .maybeSingle()
    if (error) throw error
    const ok = await verifyPassword(data?.password_hash ?? null, password)
    return ok ? data.username : null
  }
  const wrongLogin = (res) => res.status(401).json({ error: 'Invalid username or password' })

  app.post('/api/players', async (req, res) => {
    const { username, password } = req.body ?? {}
    if (!validUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-16 letters, numbers or underscores' })
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: 'Password must be 8-72 characters' })
    }
    const { data, error } = await supabase
      .from('players')
      .insert({ username, password_hash: await hashPassword(password) })
      .select('username')
      .single()
    if (error) return fail(res, error)
    res.status(201).json({ username: data.username })
  })

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body ?? {}
    const name = await authenticate(username, password)
    if (!name) return wrongLogin(res)
    res.json({ username: name })
  })

  // Both score endpoints share the same checks and just call a different database function. The player
  // is whoever the Basic auth header proves they are; a username in the body is ignored.
  const submit = (fn) => async (req, res) => {
    const { mode } = req.params
    const { score } = req.body ?? {}
    if (!validMode(mode) || !validScore(score)) return res.status(400).json({ error: 'Invalid request' })
    const credentials = parseBasic(req.get('authorization'))
    const name = credentials && (await authenticate(credentials.username, credentials.password))
    if (!name) return wrongLogin(res)
    const { data, error } = await supabase.rpc(fn, { p_mode: mode, p_username: name, p_score: score })
    if (error) return fail(res, error)
    res.json({ accepted: data === true })
  }
  app.post('/api/scores/:mode', submit('submit_score'))
  app.post('/api/leaderboard/:mode', submit('submit_leaderboard'))

  app.get('/api/leaderboard/:mode', async (req, res) => {
    const { mode } = req.params
    if (!validMode(mode)) return res.status(400).json({ error: 'Invalid mode' })
    const { data, error } = await supabase
      .from(`leaderboard_${mode}`)
      .select('score, players(username)')
      .order('score', { ascending: false })
      .order('id', { ascending: true })
      .limit(25)
    if (error) return fail(res, error)
    res.json(data.map(toEntry))
  })

  app.get('/api/scores/:mode/:username', async (req, res) => {
    const { mode, username } = req.params
    if (!validMode(mode) || !validUsername(username)) return res.status(400).json({ error: 'Invalid request' })
    // `_` is a LIKE wildcard, so escape it to match the username exactly (ignoring case).
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .ilike('username', username.replaceAll('_', '\\_'))
      .maybeSingle()
    if (playerError) return fail(res, playerError)
    if (!player) return res.status(404).json({ error: 'Unknown player' })
    const { data, error } = await supabase
      .from(`scores_${mode}`)
      .select('score, players(username)')
      .eq('player_id', player.id)
      .order('score', { ascending: false })
      .order('id', { ascending: true })
      .limit(10)
    if (error) return fail(res, error)
    res.json(data.map(toEntry))
  })

  // Anything thrown inside a route (such as a database error while checking a password) ends up here.
  app.use((error, _req, res, _next) => {
    // Bad JSON and oversized bodies are the caller's mistake; everything else is ours.
    if (error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: 'Invalid request' })
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  })

  return app
}
