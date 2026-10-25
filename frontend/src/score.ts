// The player's score for the current game. Sinking a ship scores the number it carries; chasing off
// a bird scores BIRD_POINTS.

export const BIRD_POINTS = 10

let score = 0

const listeners = new Set<() => void>()
export const subscribeScore = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getScore = () => score

function setScore(next: number) {
  score = next
  listeners.forEach((listener) => listener())
}

export const addScore = (points: number) => setScore(score + points)
export const resetScore = () => setScore(0)
