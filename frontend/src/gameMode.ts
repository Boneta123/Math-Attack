// The game mode picked after pressing Play: which operations the balls can merge with, and whether the
// game gets harder over time (see difficulty.ts).
import type { Operation } from './operations'

export type GameModeId = 'addition' | 'mixed' | 'challenge'

export type GameMode = {
  id: GameModeId
  name: string
  description: string
  operations: Operation[]
  // True when the numbers grow and ships speed up every level.
  ramps: boolean
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'addition',
    name: 'Addition',
    description: 'Add balls together. The game stays at the same speed.',
    operations: ['+'],
    ramps: false,
  },
  {
    id: 'mixed',
    name: 'Add & Multiply',
    description: 'Switch between addition and multiplication. The game stays at the same speed.',
    operations: ['+', '*'],
    ramps: false,
  },
  {
    id: 'challenge',
    name: 'Challenge',
    description: 'Addition, subtraction and multiplication. Bigger numbers and faster ships every 60 seconds.',
    operations: ['+', '-', '*'],
    ramps: true,
  },
]

let current: GameMode = GAME_MODES[GAME_MODES.length - 1]

const listeners = new Set<() => void>()
export const subscribeGameMode = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getGameMode = () => current

export function setGameMode(id: GameModeId) {
  current = GAME_MODES.find((mode) => mode.id === id) ?? current
  listeners.forEach((listener) => listener())
}
