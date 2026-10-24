// Puts the whole game back to its starting state after a game over.
import { resetBird } from './bird'
import { resetCannons } from './cannons'
import { resetLives } from './lives'
import { resetShips } from './ships'

export function restartGame() {
  resetShips()
  resetCannons()
  resetBird()
  resetLives()
}
