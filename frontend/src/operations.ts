// The arithmetic operation used when the two held balls merge, picked as the mode on the home screen.
// A merge reads "right op left" (the right-hand ball is the one acted on), and the right hand keeps the result.

export type Operation = '+' | '*'
export const OPERATIONS: Operation[] = ['+', '*']

let current: Operation = '+'

const listeners = new Set<() => void>()
export const subscribeOperation = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getOperation = () => current

export function setOperation(op: Operation) {
  current = op
  listeners.forEach((listener) => listener())
}

// right op left, or null when the result is below 1 (no zero or negative balls).
export function applyOperation(op: Operation, right: number, left: number): number | null {
  const result = op === '+' ? right + left : right * left
  return result >= 1 ? result : null
}
