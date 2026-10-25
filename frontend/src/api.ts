// Calls to the Express backend (see backend/). Every call can fail, so callers handle the rejection.
import type { GameModeId } from './gameMode'
import type { Account } from './player'

export type Entry = { username: string; score: number }

const BASE = import.meta.env.VITE_API_URL ?? 'https://math-attack-9zrl.onrender.com'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// `Authorization: Basic base64(username:password)`, encoded as UTF-8 so any password works.
const basicAuth = ({ username, password }: Account) =>
  'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`)))

async function request<T>(path: string, body?: unknown, account?: Account): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (account) headers.Authorization = basicAuth(account)
  const response = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'Request failed')
  return data as T
}

// True when the API and its database answer within a few seconds.
export const checkHealth = () =>
  fetch(BASE + '/api/health', { signal: AbortSignal.timeout(3000) })
    .then((response) => response.ok)
    .catch(() => false)

export const createPlayer = (username: string, password: string) =>
  request<{ username: string }>('/api/players', { username, password })

export const login = (username: string, password: string) =>
  request<{ username: string }>('/api/login', { username, password })

export const postScore = (mode: GameModeId, account: Account, score: number) =>
  request<{ accepted: boolean }>(`/api/scores/${mode}`, { score }, account)

export const postLeaderboard = (mode: GameModeId, account: Account, score: number) =>
  request<{ accepted: boolean }>(`/api/leaderboard/${mode}`, { score }, account)

export const getLeaderboard = (mode: GameModeId) => request<Entry[]>(`/api/leaderboard/${mode}`)

export const getMyScores = (mode: GameModeId, username: string) =>
  request<Entry[]>(`/api/scores/${mode}/${encodeURIComponent(username)}`)
