// The game gets harder the longer a run lasts. Every LEVEL_SECONDS of play the range of numbers on
// the ships moves up by SHIP_RANGE_STEP at both ends, and the numbers the balls spawn with move up by
// BALL_RANGE_STEP at both ends (1, 2, 3 -> 2, 3, 4 -> 3, 4, 5 ...), and the time between ship spawns shrinks by
// SHIP_INTERVAL_STEP down to a floor. Time only counts while a game is running, and only in a game mode
// that ramps up (see gameMode.ts); the other modes stay at level 0.
import { getGameMode } from './gameMode'

export const LEVEL_SECONDS = 60
export const SHIP_RANGE_STEP = 4
export const BALL_RANGE_STEP = 1
// Seconds between ship spawns at level 0, how much each level takes off, and the lowest it can reach.
export const BASE_SHIP_INTERVAL = 20
export const SHIP_INTERVAL_STEP = 5
export const MIN_SHIP_INTERVAL = 5

// Level 0 ranges (inclusive).
const SHIP_MIN = 1
const SHIP_MAX = 9
const BALL_MIN = 1
// How many different numbers balls spawn with (they cycle through them in order).
export const BALL_RANGE_SIZE = 3

let elapsed = 0

// Per-frame step (dt in seconds); call only while the game is running.
export function stepDifficulty(dt: number) {
  if (!getGameMode().ramps) return
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

// Seconds between ship spawns at the current level (20, 15, 10, 5, then 5 from there on).
export const shipSpawnInterval = () => Math.max(MIN_SHIP_INTERVAL, BASE_SHIP_INTERVAL - SHIP_INTERVAL_STEP * getLevel())
