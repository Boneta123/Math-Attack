// Which screen is showing (the home screen or the game) and resetting the game for a new run.
import { resetBalls } from './balls'
import { resetBird } from './bird'
import { resetCannons } from './cannons'
import { resetDifficulty } from './difficulty'
import { getLives, resetLives } from './lives'
import { resetOperation } from './operations'
import { resetScore } from './score'
import { resetShips } from './ships'

export type Screen = 'home' | 'modeSelect' | 'calibrating' | 'playing'

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
  resetDifficulty()
  resetBalls()
  resetShips()
  resetCannons()
  resetBird()
  resetLives()
  resetScore()
  resetOperation()
}

// Play on the home screen: pick a game mode first (see ModeSelect.tsx).
export function chooseGameMode() {
  setScreen('modeSelect')
}

// After picking a game mode: line the hands up in the outlines (see Calibration.tsx).
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
