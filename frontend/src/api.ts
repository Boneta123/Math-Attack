// Calls to the Express backend (see backend/). Every call can fail, so callers handle the rejection.
import type { GameModeId } from './gameMode'

export type Entry = { username: string; score: number }

const BASE = import.meta.env.VITE_API_URL ?? 'https://math-attack-9zrl.onrender.com'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
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

export const createPlayer = (username: string) => request<{ username: string }>('/api/players', { username })

export const postScore = (mode: GameModeId, username: string, score: number) =>
  request<{ accepted: boolean }>(`/api/scores/${mode}`, { username, score })

export const postLeaderboard = (mode: GameModeId, username: string, score: number) =>
  request<{ accepted: boolean }>(`/api/leaderboard/${mode}`, { username, score })

export const getLeaderboard = (mode: GameModeId) => request<Entry[]>(`/api/leaderboard/${mode}`)

export const getMyScores = (mode: GameModeId, username: string) =>
  request<Entry[]>(`/api/scores/${mode}/${encodeURIComponent(username)}`)
