// The game gets harder the longer a run lasts. Every LEVEL_SECONDS of play the range of numbers on
// the ships moves up by SHIP_RANGE_STEP at both ends, and the numbers the balls spawn with move up by
// BALL_RANGE_STEP at both ends (1, 2, 3 -> 2, 3, 4 -> 3, 4, 5 ...). Time only counts while a game is running.

export const LEVEL_SECONDS = 30
export const SHIP_RANGE_STEP = 4
export const BALL_RANGE_STEP = 1

// Level 0 ranges (inclusive).
const SHIP_MIN = 1
const SHIP_MAX = 9
const BALL_MIN = 1
// How many different numbers balls spawn with (they cycle through them in order).
export const BALL_RANGE_SIZE = 3

let elapsed = 0

// Per-frame step (dt in seconds); call only while the game is running.
export function stepDifficulty(dt: number) {
  elapsed += Math.min(dt, 0.1)
}

export const resetDifficulty = () => {
  elapsed = 0
}

export const getLevel = () => Math.floor(elapsed / LEVEL_SECONDS)

// Numbers a new ship can carry.
export function shipRange() {
  const shift = getLevel() * SHIP_RANGE_STEP
  return { min: SHIP_MIN + shift, max: SHIP_MAX + shift }
}

// Lowest number a new ball spawns with; it spawns BALL_RANGE_SIZE numbers upward from there.
export const ballMin = () => BALL_MIN + getLevel() * BALL_RANGE_STEP
