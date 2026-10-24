// Which screen is showing (the home screen or the game) and resetting the game for a new run.
import { resetBird } from './bird'
import { resetCannons } from './cannons'
import { getLives, resetLives } from './lives'
import { resetShips } from './ships'

export type Screen = 'home' | 'calibrating' | 'playing'

let screen: Screen = 'home'

const listeners = new Set<() => void>()
export const subscribeScreen = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getScreen = () => screen

function setScreen(next: Screen) {
  screen = next
  listeners.forEach((listener) => listener())
}

// Ships, cannons and the bird only move while a game is being played and lives remain.
export const isGameRunning = () => screen === 'playing' && getLives() > 0

// Puts the whole game back to its starting state.
export function restartGame() {
  resetShips()
  resetCannons()
  resetBird()
  resetLives()
}

// Play on the home screen: line the hands up in the outlines first (see Calibration.tsx).
export function beginCalibration() {
  setScreen('calibrating')
}

export function startGame() {
  restartGame()
  setScreen('playing')
}

export function goHome() {
  restartGame()
  setScreen('home')
}
