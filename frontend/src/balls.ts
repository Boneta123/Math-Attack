import { BALL_ROW_Y, LANES, tryLoadCannon } from './cannons'

// Only 1, 2 and 3 ever spawn; every larger number is made by combining them.
export const BALL_VALUES = [1, 2, 3]

// Invisible single row in the hand zone (bottom 45% of the screen, starting at the shoreline): 1 row x 10 columns = 10
// slots, one under each cannon. Resting balls always sit in a slot, so any ball is easy to pick out.
const COLS = LANES
const ROWS = 1
export const MAX_BALLS = COLS * ROWS
// Ball radius as a fraction of the smaller cell dimension: sized so all 10 fit with a small gap.
const BALL_FILL = 0.44
// Seconds between new balls funnelling in from the sides (while there is room).
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
type Side = 'left' | 'right'

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

// Ball radius in screen pixels for a game area of cw x ch. Fixed so that 10 balls always fit.
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

// Bring a new ball in from the left or right edge. It enters the end slot of a lane (row); if
// that slot is taken, the run of balls next to it slides one slot inward to make room.
// Returns false when no lane has a free slot.
function spawnBall(side: Side): boolean {
  const lanes = Array.from({ length: ROWS }, (_, row) => ({
    row,
    cells: Array.from({ length: COLS }, (_, col) => balls.find((b) => b.slot === row * COLS + col) ?? null),
  }))
    .filter((lane) => lane.cells.includes(null))
    // emptiest lane first; on a tie, the lower row
    .sort((p, q) => p.cells.filter(Boolean).length - q.cells.filter(Boolean).length || q.row - p.row)
  const lane = lanes[0]
  if (!lane) return false

  // Column order walking inward from the entry side.
  const inward = Array.from({ length: COLS }, (_, i) => (side === 'left' ? i : COLS - 1 - i))
  const free = inward.findIndex((col) => lane.cells[col] === null)
  for (let k = free; k > 0; k--) {
    lane.cells[inward[k - 1]]!.slot = lane.row * COLS + inward[k]
  }

  const slot = lane.row * COLS + inward[0]
  const value = BALL_VALUES[Math.floor(Math.random() * BALL_VALUES.length)]
  // Starts just off the screen edge, level with its row, then glides in.
  balls.push({ id: nextBallId++, value, x: side === 'left' ? -0.06 : 1.06, y: slotCenter(slot).y, heldBy: null, slot })
  return true
}

let spawnTimer = 0
let nextSide: Side = 'left'

// Per-frame step (dt in seconds): bring in new balls over time, and glide resting balls to their slots.
export function stepBalls(dt: number) {
  spawnTimer = Math.min(spawnTimer + dt, SPAWN_INTERVAL)
  if (spawnTimer >= SPAWN_INTERVAL && balls.length < MAX_BALLS && spawnBall(nextSide)) {
    spawnTimer = 0
    nextSide = nextSide === 'left' ? 'right' : 'left'
    notifyBalls()
  }

  const k = 1 - Math.exp(-SETTLE_RATE * Math.min(dt, 0.1))
  for (const ball of balls) {
    if (ball.slot === null) continue
    const target = slotCenter(ball.slot)
    ball.x += (target.x - ball.x) * k
    ball.y += (target.y - ball.y) * k
  }
}
