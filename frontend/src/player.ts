// The player's username, remembered in this browser. It is the only account data there is.

const KEY = 'numberRushUsername'

function load() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

let username: string | null = load()

const listeners = new Set<() => void>()
export const subscribeUsername = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getUsername = () => username

export function setUsername(next: string | null) {
  username = next
  try {
    if (next) localStorage.setItem(KEY, next)
    else localStorage.removeItem(KEY)
  } catch {
    // Private windows can block storage; the name then lasts until the page closes.
  }
  listeners.forEach((listener) => listener())
}
