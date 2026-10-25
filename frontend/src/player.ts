// The player's account, remembered in this browser: a username and the password that goes with it. The
// password is sent as Basic auth when saving scores, so it is kept here (over HTTPS only).

export type Account = { username: string; password: string }

const KEY = 'numberRushAccount'

function load(): Account | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return typeof saved?.username === 'string' && typeof saved?.password === 'string' ? saved : null
  } catch {
    return null
  }
}

let account: Account | null = load()

const listeners = new Set<() => void>()
export const subscribeUsername = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getAccount = () => account
export const getUsername = () => account?.username ?? null

export function setAccount(next: Account | null) {
  account = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // Private windows can block storage; the account then lasts until the page closes.
  }
  listeners.forEach((listener) => listener())
}
