// The player's remaining lives. An enemy ship that reaches the cannons, or a bird that charges the
// player, costs one life.
import { onBirdHit } from './bird'
import { onShipLanded } from './ships'

export const MAX_LIVES = 3

let lives = MAX_LIVES

const listeners = new Set<() => void>()
export const subscribeLives = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getLives = () => lives

export function loseLife() {
  if (lives === 0) return
  lives--
  listeners.forEach((listener) => listener())
}

export function resetLives() {
  lives = MAX_LIVES
  listeners.forEach((listener) => listener())
}

onShipLanded(loseLife)
onBirdHit(loseLife)
