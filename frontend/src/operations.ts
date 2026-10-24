// The arithmetic operation used when the two held balls merge. Pointing up cycles it. The right
// hand is the primary hand, so a merge reads "right op left".
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

// Per-frame step: switch to the next operation each time a hand starts pointing up (MediaPipe's
// Pointing_Up gesture, see handTracking.ts). A pinching hand is busy holding a ball, so it is ignored.
const wasPointing = { left: false, right: false }
export function updateOperation(hands: { left: HandAnchors; right: HandAnchors }) {
  let started = false
  for (const key of ['left', 'right'] as const) {
    const hand = hands[key]
    const pointing = hand.present && !hand.pinch && hand.gesture === 'Pointing_Up'
    if (pointing && !wasPointing[key]) started = true
    wasPointing[key] = pointing
  }
  if (started) setOperation(OPERATIONS[(OPERATIONS.indexOf(current) + 1) % OPERATIONS.length])
}
export const getOperationVersion = () => version
