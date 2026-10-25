// Whether the backend is reachable. Checked once when the page loads. When it is not, the game still
// plays: there is no username, leaderboard or score saving.
import { checkHealth } from './api'

export type Online = 'checking' | 'online' | 'offline'

let status: Online = 'checking'

const listeners = new Set<() => void>()
export const subscribeOnline = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getOnline = () => status

void checkHealth().then((ok) => {
  status = ok ? 'online' : 'offline'
  listeners.forEach((listener) => listener())
})
