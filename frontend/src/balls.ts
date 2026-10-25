import { BALL_COLS, BALL_ROW_Y, tryLoadCannon } from './cannons'
import { ACTION_BUFFER_MS } from './handTracking'
import { BALL_RANGE_SIZE, ballMin } from './difficulty'
import { applyOperation, getOperation } from './operations'

// Only 1, 2 and 3 ever spawn, cycling in that order; every larger number is made by combining them.
export const BALL_VALUES = [1, 2, 3]

// Invisible single row in the hand zone (bottom 45% of the screen, starting at the shoreline): 1 row x 6 columns = 6
// slots, with a cannon above each gap between neighbouring slots. Resting balls always sit in a slot, so any ball is easy to pick out.
const COLS = BALL_COLS
const ROWS = 1
export const MAX_BALLS = COLS * ROWS
// Ball radius as a fraction of the smaller cell dimension: 3/4 of the size that just fit all 6.
const BALL_FILL = 0.33
// Seconds between new balls entering from the left edge of the row (while there is room).
const SPAWN_INTERVAL = 3
// The cannonball rack slopes down to the right: its height drops by RACK_DROP of the screen height
// across the full screen width. Balls rest on it and roll down it, speeding up under ROLL_ACCEL
// (screen widths per second squared) until the end stop or the ball ahead stops them; a ball that
// arrives fast enough bounces back a little (BOUNCE of its speed).
export const RACK_DROP = 0.07
const ROLL_ACCEL = 1.5
const BOUNCE = 0.18
const BOUNCE_MIN_SPEED = 0.25
// Height of the rack's ball line at normalized x (the balls' centres follow it).
export const rackY = (x: number) => BALL_ROW_Y + RACK_DROP * (x - 0.5)
// Where a ball starts when it enters the row from the left (just off the screen edge).
const ENTRY_X = -0.08
// Slot value of a ball that has just entered: left of every other ball until packRight reassigns it.
const ENTRY_SLOT = -1

// A pinch closing this many radii from a ball's center still picks it up (the pinch point is
// the midpoint of two fingertips, so this is a little forgiving).
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
  // Rolling speed along the rack in screen widths per second (resting balls only).
  vx: number
  // Grid slot (row * COLS + col) while resting; null while held. Resting balls glide to their slot.
  slot: number | null
}

// Center of a slot in normalized screen space. The single row sits on the rack in the hand zone, just
// below the shoreline, with the cannons directly above it.
const slotCenter = (slot: number) => {
  const x = ((slot % COLS) + 0.5) / COLS
  return { x, y: rackY(x) }
}

// Mutated in place (merging and spawning add and remove balls), never reassigned.
// The first rack sits at the right end of the row; resting balls always pack against the right.
export const balls: Ball[] = BALL_VALUES.map((value, i) => {
  const slot = COLS - BALL_VALUES.length + i
  return { id: i + 1, value, ...slotCenter(slot), vx: 0, heldBy: null, slot }
})

let nextBallId = BALL_VALUES.length + 1
// Which of the range's numbers the next spawned ball takes (the starting rack used 1, 2, 3 already).
let nextValueIndex = 0

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
  pinch: boolean // index and middle fingertips together
  point: { x: number; y: number } // the pinch point, in screen pixels
}

// Per hand: when the pinch started closing over a ball (null = not timing), when it started being
// open while holding a ball, and whether it must open before it may grab again (after a merge frees it).
const closedSince: Record<HandKey, number | null> = { left: null, right: null }
const openSince: Record<HandKey, number | null> = { left: null, right: null }
const mustReopen: Record<HandKey, boolean> = { left: false, right: false }

// Resting balls form a queue packed against the right end of the row: the oldest ball is the
// rightmost, the newest (or just-released) ball the leftmost. Whenever a ball enters, leaves or is
// picked up, the others slide right to close the gap, so you can follow where every ball goes.
function packRight() {
  const resting = balls.filter((b) => b.slot !== null).sort((p, q) => p.slot! - q.slot!)
  resting.forEach((ball, i) => {
    ball.slot = COLS - resting.length + i
  })
}

// A released ball (not dropped on a cannon) re-enters the row from the left edge.
function sendToEntry(ball: Ball) {
  ball.heldBy = null
  ball.slot = ENTRY_SLOT
  ball.x = ENTRY_X
  ball.y = rackY(ENTRY_X)
  ball.vx = 0
  packRight()
}

// Pick up once the fingers have stayed pinched over a ball for ACTION_BUFFER_MS, follow the pinch
// point while they stay together, and release (or load a cannon) once they have stayed open, or the
// hand untracked, for ACTION_BUFFER_MS. Until then the ball stays put at the last pinch point, so
// flicker and brief tracking drops cannot grab or drop anything.
// When both hands hold a ball and the two touch, they merge into one ball (the result) that
// stays in the right hand.
export function updateBalls(hands: Record<HandKey, HandInput>, cw: number, ch: number, now = performance.now()) {
  const radius = ballRadiusPx(cw, ch)

  for (const key of ['left', 'right'] as const) {
    const hand = hands[key]
    const grabbing = hand.present && hand.pinch
    if (!grabbing) mustReopen[key] = false
    const held = balls.find((b) => b.heldBy === key)

    if (!held) {
      openSince[key] = null
      // The ball (if any) the pinch is over, nearest first.
      let target: Ball | null = null
      if (grabbing && !mustReopen[key]) {
        let bestDist = radius * GRAB_REACH
        for (const ball of balls) {
          if (ball.heldBy) continue
          const d = Math.hypot(hand.point.x - ball.x * cw, hand.point.y - ball.y * ch)
          if (d <= bestDist) {
            target = ball
            bestDist = d
          }
        }
      }
      if (!target) {
        closedSince[key] = null
      } else {
        closedSince[key] ??= now
        if (now - closedSince[key]! >= ACTION_BUFFER_MS) {
          target.heldBy = key
          target.slot = null // frees the slot; the balls to its left slide right to fill it
          packRight()
          closedSince[key] = null
        }
      }
      continue
    }

    closedSince[key] = null
    if (grabbing) {
      openSince[key] = null
      held.x = Math.min(Math.max(hand.point.x / cw, EDGE_MARGIN), 1 - EDGE_MARGIN)
      held.y = Math.min(Math.max(hand.point.y / ch, EDGE_MARGIN), 1 - EDGE_MARGIN)
      continue
    }
    openSince[key] ??= now
    if (now - openSince[key]! < ACTION_BUFFER_MS) continue
    openSince[key] = null
    if (tryLoadCannon(held.value, held.x, held.y, cw, ch)) {
      // The cannon swallows the ball; it reappears as the shot a moment later.
      balls.splice(balls.indexOf(held), 1)
      packRight()
      notifyBalls()
    } else {
      sendToEntry(held)
    }
  }

  mergeHeldBalls(cw, ch, radius)
}

function mergeHeldBalls(cw: number, ch: number, radius: number) {
  const a = balls.find((b) => b.heldBy === 'left')
  const b = balls.find((b) => b.heldBy === 'right')
  if (!a || !b) return
  if (Math.hypot((a.x - b.x) * cw, (a.y - b.y) * ch) > radius * MERGE_DISTANCE) return

  // The right ball is the one the operation acts on: (right ball) op (left ball). A result below 1
  // is not allowed (for example 1 - 3), so those balls stay as they are.
  const value = applyOperation(getOperation(), b.value, a.value)
  if (value === null) return

  // The new ball takes the right ball's spot, which is already at the right pinch point.
  balls.splice(balls.indexOf(a), 1)
  balls.splice(balls.indexOf(b), 1)
  balls.push({ id: nextBallId++, value, x: b.x, y: b.y, vx: 0, heldBy: 'right', slot: null })

  // The left fingers are still pinched, so the left hand must open before it may grab again.
  mustReopen.left = true
  closedSince.left = null
  notifyBalls()
}

// Bring a new ball in from the left edge of the row; it slides right to the first free slot next
// to the balls already there. Returns false when the row is full.
function spawnBall(): boolean {
  if (balls.length >= MAX_BALLS) return false
  // Cycle through the three numbers of the current range (1, 2, 3 -> 2, 3, 4 -> ... as the game levels up).
  const value = ballMin() + nextValueIndex
  nextValueIndex = (nextValueIndex + 1) % BALL_RANGE_SIZE
  balls.push({ id: nextBallId++, value, x: ENTRY_X, y: rackY(ENTRY_X), vx: 0, heldBy: null, slot: ENTRY_SLOT })
  packRight()
  return true
}

let spawnTimer = 0

// Puts the starting rack (1, 2, 3 at the right end of the row) back for a new game, dropping any
// held or combined balls. Call after resetDifficulty so later spawns start from the lowest range.
export function resetBalls() {
  balls.length = 0
  BALL_VALUES.forEach((value, i) => {
    const slot = COLS - BALL_VALUES.length + i
    balls.push({ id: nextBallId++, value, ...slotCenter(slot), vx: 0, heldBy: null, slot })
  })
  nextValueIndex = 0
  spawnTimer = 0
  for (const key of ['left', 'right'] as const) {
    closedSince[key] = null
    openSince[key] = null
    mustReopen[key] = false
  }
  notifyBalls()
}

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

  // Resting balls roll down the rack toward their slot instead of sliding.
  const step = Math.min(dt, 0.1)
  for (const ball of balls) {
    if (ball.slot === null) {
      ball.vx = 0
      continue
    }
    const target = slotCenter(ball.slot)
    if (ball.vx < 0) {
      // Rebounding off the stop: the slope slows the backward roll, then it rolls forward again.
      ball.vx = Math.min(ball.vx + ROLL_ACCEL * step, 0)
      ball.x += ball.vx * step
    } else if (ball.x < target.x - 1e-4) {
      ball.vx += ROLL_ACCEL * step
      ball.x = Math.min(ball.x + ball.vx * step, target.x)
      if (ball.x >= target.x) ball.vx = ball.vx > BOUNCE_MIN_SPEED ? -ball.vx * BOUNCE : 0
    } else {
      ball.x = target.x
      ball.vx = 0
    }
    ball.y = rackY(ball.x)
  }
}
