import { BALL_COLS, BALL_ROW_Y, tryLoadCannon } from './cannons'

// Only 1, 2 and 3 ever spawn; every larger number is made by combining them.
export const BALL_VALUES = [1, 2, 3]

// Invisible single row in the hand zone (bottom 45% of the screen, starting at the shoreline): 1 row x 6 columns = 6
// slots, with a cannon above each gap between neighbouring slots. Resting balls always sit in a slot, so any ball is easy to pick out.
const COLS = BALL_COLS
const ROWS = 1
export const MAX_BALLS = COLS * ROWS
// Ball radius as a fraction of the smaller cell dimension: 3/4 of the size that just fit all 6.
const BALL_FILL = 0.33
// Seconds between new balls arriving at the middle of the row (while there is room).
const SPAWN_INTERVAL = 3
// How quickly balls glide to their slot (higher = snappier).
const SETTLE_RATE = 12

// A pinch closing this many radii from a ball's center still picks it up (the pinch point is
// the midpoint of the thumb and index fingertips, so this is a little forgiving).
const GRAB_REACH = 1.5
const EDGE_MARGIN = 0.03
// Two held balls merge once their centers are this many radii apart or closer (touching).
const MERGE_DISTANCE = 2

export type HandKey = 'left' | 'right'

export type Ball = {
  id: number
  value: number
  // Center in normalized screen space (0..1 of the game area). Plain mutable data, read every frame.
  x: number
  y: number
  heldBy: HandKey | null
  // Grid slot (row * COLS + col) while resting; null while held. Resting balls glide to their slot.
  slot: number | null
}

// Center of a grid slot in normalized screen space. The single row sits in the hand zone, just below the shoreline,
// with the cannons directly above it.
const slotCenter = (slot: number) => ({
  x: ((slot % COLS) + 0.5) / COLS,
  y: BALL_ROW_Y,
})

// Mutated in place (merging and spawning add and remove balls), never reassigned.
// The first rack sits in the middle of the row.
export const balls: Ball[] = BALL_VALUES.map((value, i) => {
  const slot = Math.floor((COLS - BALL_VALUES.length) / 2) + i
  return { id: i + 1, value, ...slotCenter(slot), heldBy: null, slot }
})

let nextBallId = BALL_VALUES.length + 1

// Adding or removing balls changes what the renderer draws, so it subscribes to this (not per frame).
let ballsVersion = 0
const listeners = new Set<() => void>()
export const subscribeBalls = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getBallsVersion = () => ballsVersion
function notifyBalls() {
  ballsVersion++
  listeners.forEach((listener) => listener())
}

// Ball radius in screen pixels for a game area of cw x ch. Fixed so that 6 balls always fit.
export const ballRadiusPx = (cw: number, ch: number) =>
  BALL_FILL * Math.min(cw / COLS, ch / 3 / ROWS)

export type HandInput = {
  present: boolean
  pinch: boolean // thumb and index fingertips together
  point: { x: number; y: number } // the pinch point, in screen pixels
}

const wasGrabbing: Record<HandKey, boolean> = { left: false, right: false }

// Put a released ball into the nearest free grid slot (it glides there).
function snapToGrid(ball: Ball, cw: number, ch: number) {
  const taken = new Set(balls.map((b) => b.slot))
  let best: number | null = null
  let bestDist = Infinity
  for (let slot = 0; slot < MAX_BALLS; slot++) {
    if (taken.has(slot)) continue
    const c = slotCenter(slot)
    const d = Math.hypot((c.x - ball.x) * cw, (c.y - ball.y) * ch)
    if (d < bestDist) {
      best = slot
      bestDist = d
    }
  }
  ball.slot = best
}

// Pick up when the thumb and index finger pinch together over a ball, follow the pinch point while they stay
// together, snap into the nearest free slot when they separate or the hand disappears.
// When both hands hold a ball and the two touch, they merge into one ball (the sum) that
// stays in the right hand.
export function updateBalls(hands: Record<HandKey, HandInput>, cw: number, ch: number) {
  const radius = ballRadiusPx(cw, ch)

  for (const key of ['left', 'right'] as const) {
    const hand = hands[key]
    const grabbing = hand.present && hand.pinch

    if (grabbing && !wasGrabbing[key] && !balls.some((b) => b.heldBy === key)) {
      let best: Ball | null = null
      let bestDist = radius * GRAB_REACH
      for (const ball of balls) {
        if (ball.heldBy) continue
        const d = Math.hypot(hand.point.x - ball.x * cw, hand.point.y - ball.y * ch)
        if (d <= bestDist) {
          best = ball
          bestDist = d
        }
      }
      if (best) {
        best.heldBy = key
        best.slot = null // frees the slot; other balls may slide into it
      }
    }

    // Copy: a ball dropped on a cannon is removed from the array mid-loop.
    for (const ball of [...balls]) {
      if (ball.heldBy !== key) continue
      if (grabbing) {
        ball.x = Math.min(Math.max(hand.point.x / cw, EDGE_MARGIN), 1 - EDGE_MARGIN)
        ball.y = Math.min(Math.max(hand.point.y / ch, EDGE_MARGIN), 1 - EDGE_MARGIN)
      } else if (tryLoadCannon(ball.value, ball.x, ball.y, cw, ch)) {
        // The cannon swallows the ball; it reappears as the shot a moment later.
        balls.splice(balls.indexOf(ball), 1)
        notifyBalls()
      } else {
        ball.heldBy = null
        snapToGrid(ball, cw, ch)
      }
    }

    wasGrabbing[key] = grabbing
  }

  mergeHeldBalls(cw, ch, radius)
}

function mergeHeldBalls(cw: number, ch: number, radius: number) {
  const a = balls.find((b) => b.heldBy === 'left')
  const b = balls.find((b) => b.heldBy === 'right')
  if (!a || !b) return
  if (Math.hypot((a.x - b.x) * cw, (a.y - b.y) * ch) > radius * MERGE_DISTANCE) return

  // The new ball takes the right ball's spot, which is already at the right pinch point.
  balls.splice(balls.indexOf(a), 1)
  balls.splice(balls.indexOf(b), 1)
  balls.push({ id: nextBallId++, value: a.value + b.value, x: b.x, y: b.y, heldBy: 'right', slot: null })

  // The left pinch is still closed, so wasGrabbing.left stays true and it cannot re-grab
  // until the thumb and finger separate and pinch again.
  notifyBalls()
}

// Bring a new ball in at the middle of the row (hands cannot reach the screen edges), and let it
// glide to the free slot nearest the middle. Returns false when every slot is taken.
function spawnBall(): boolean {
  const taken = new Set(balls.map((b) => b.slot))
  const free = Array.from({ length: MAX_BALLS }, (_, slot) => slot).filter((slot) => !taken.has(slot))
  if (free.length === 0) return false
  const middle = (COLS - 1) / 2
  const distance = (slot: number) => Math.abs((slot % COLS) - middle)
  const nearest = Math.min(...free.map(distance))
  const candidates = free.filter((slot) => distance(slot) === nearest)
  const slot = candidates[Math.floor(Math.random() * candidates.length)]
  const value = BALL_VALUES[Math.floor(Math.random() * BALL_VALUES.length)]
  balls.push({ id: nextBallId++, value, x: 0.5, y: slotCenter(slot).y, heldBy: null, slot })
  return true
}

let spawnTimer = 0

// Per-frame step (dt in seconds): bring in new balls over time, and glide resting balls to their slots.
export function stepBalls(dt: number) {
  // The timer only runs while there is room, so a new ball arrives SPAWN_INTERVAL seconds after
  // room opens up (and every SPAWN_INTERVAL seconds after that while there is room).
  if (balls.length >= MAX_BALLS) {
    spawnTimer = 0
  } else {
    spawnTimer += dt
    if (spawnTimer >= SPAWN_INTERVAL && spawnBall()) {
      spawnTimer = 0
      notifyBalls()
    }
  }

  const k = 1 - Math.exp(-SETTLE_RATE * Math.min(dt, 0.1))
  for (const ball of balls) {
    if (ball.slot === null) continue
    const target = slotCenter(ball.slot)
    ball.x += (target.x - ball.x) * k
    ball.y += (target.y - ball.y) * k
  }
}
