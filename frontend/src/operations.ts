// The arithmetic operation used when the two held balls merge. Closing both fists moves it up the list. A merge reads
// "right op left" (the right-hand ball is the one acted on), and the right hand keeps the result.
import type { HandAnchors } from './handTracking'

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

// right op left, or null when the result is below 1 (no zero or negative balls).
export function applyOperation(op: Operation, right: number, left: number): number | null {
  const result = op === '+' ? right + left : op === '-' ? right - left : right * left
  return result >= 1 ? result : null
}

// Per-frame step: switch to the operation above each time BOTH hands close into fists together
// (the Closed_Fist gesture, see handTracking.ts). One fist does nothing, and a pinching hand is
// busy holding a ball, so it does not count. A fist is used rather than pointing up because a
// pointing finger was easily mistaken for the start of a grab.
let wasBothFists = false
export function updateOperation(hands: { left: HandAnchors; right: HandAnchors }) {
  const fist = (hand: HandAnchors) => hand.present && !hand.pinch && hand.gesture === 'Closed_Fist'
  const both = fist(hands.left) && fist(hands.right)
  if (both && !wasBothFists) {
    // Closing both fists moves the highlight up the inventory list; from the top it wraps to the bottom.
    setOperation(OPERATIONS[(OPERATIONS.indexOf(current) - 1 + OPERATIONS.length) % OPERATIONS.length])
  }
  wasBothFists = both
}
export const getOperationVersion = () => version
