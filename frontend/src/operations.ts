// The arithmetic operation used when the two held balls merge. Pointing up cycles it. A merge reads
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

// Per-frame step: switch to the next operation each time BOTH hands start pointing up together
// (MediaPipe's Pointing_Up gesture, see handTracking.ts). One hand pointing does nothing, and a
// pinching hand is busy holding a ball, so it does not count.
let wasBothPointing = false
export function updateOperation(hands: { left: HandAnchors; right: HandAnchors }) {
  const pointing = (hand: HandAnchors) => hand.present && !hand.pinch && hand.gesture === 'Pointing_Up'
  const both = pointing(hands.left) && pointing(hands.right)
  if (both && !wasBothPointing) {
    setOperation(OPERATIONS[(OPERATIONS.indexOf(current) + 1) % OPERATIONS.length])
  }
  wasBothPointing = both
}
export const getOperationVersion = () => version
