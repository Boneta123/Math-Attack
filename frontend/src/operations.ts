// The arithmetic operation used when the two held balls merge. Lifting either thumb off its curled ring
// and little fingers moves it up
// the list of operations the game mode allows (see gameMode.ts); the big boxes in the top right only show
// which one is active. A merge reads
// "right op left" (the right-hand ball is the one acted on), and the right hand keeps the result.
import { getGameMode } from './gameMode'
import { ACTION_BUFFER_MS, isThumbAway, type HandAnchors } from './handTracking'

export type Operation = '+' | '-' | '*'
export const OPERATIONS: Operation[] = ['+', '-', '*']

let current: Operation = '+'

let version = 0
const listeners = new Set<() => void>()
export const subscribeOperation = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getOperation = () => current

function setOperation(op: Operation) {
  current = op
  version++
  listeners.forEach((listener) => listener())
}

// Back to the game mode's first operation, for a new game.
export const resetOperation = () => setOperation(getGameMode().operations[0])

// right op left, or null when the result is below 1 (no zero or negative balls).
export function applyOperation(op: Operation, right: number, left: number): number | null {
  const result = op === '+' ? right + left : op === '-' ? right - left : right * left
  return result >= 1 ? result : null
}

// Per-frame step: when either hand holds its thumb away from its curled ring and little fingers for
// ACTION_BUFFER_MS without a break, move to the operation above (wrapping from the top to the bottom).
// It fires once per release and re-arms when the thumb is back on those fingers. It works while the hand
// is pinching a ball (the thumb is free then), but a fully open hand is the scythe and does not count.
// Call it only while a game is running.
let thumbOutSince: number | null = null
let thumbHandled = false
export function updateThumbSwitch(hands: HandAnchors[], now = performance.now()) {
  const wasOut = thumbOutSince !== null
  const out = hands.some(
    (hand) => hand.present && hand.gesture !== 'Open_Palm' && isThumbAway(hand.landmarks, wasOut),
  )
  if (!out) {
    thumbOutSince = null
    thumbHandled = false
    return
  }
  thumbOutSince ??= now
  if (!thumbHandled && now - thumbOutSince >= ACTION_BUFFER_MS) {
    thumbHandled = true
    const available = getGameMode().operations
    if (available.length < 2) return
    setOperation(available[(available.indexOf(current) - 1 + available.length) % available.length])
  }
}
export const getOperationVersion = () => version
