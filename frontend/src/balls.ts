export const BALL_VALUES = [1, 2, 3, 4, 5]

// Ball radius relative to the original layout (slightly smaller than before).
const BALL_SCALE = 0.85
// A fist closing this many radii from a ball's center still picks it up.
const GRAB_REACH = 1.25
const EDGE_MARGIN = 0.03

export type HandKey = 'left' | 'right'

export type Ball = {
  value: number
  // Center in normalized screen space (0..1 of the game area). Plain mutable data, read every frame.
  x: number
  y: number
  heldBy: HandKey | null
}

// The hand zone is the bottom third of the screen, so the rack starts at y = 5/6.
export const balls: Ball[] = BALL_VALUES.map((value, i) => ({
  value,
  x: (i + 1) / (BALL_VALUES.length + 1),
  y: 5 / 6,
  heldBy: null,
}))

// Ball radius in screen pixels for a game area of cw x ch.
export const ballRadiusPx = (cw: number, ch: number) =>
  Math.min((ch / 3) * 0.3, cw / (BALL_VALUES.length * 2.6)) * BALL_SCALE

export type HandInput = {
  present: boolean
  grab: boolean // closed fist
  palm: { x: number; y: number } // screen pixels
}

const wasGrabbing: Record<HandKey, boolean> = { left: false, right: false }

// Pick up on open -> fist over a ball, follow the palm while the fist stays closed,
// drop in place when the hand opens or disappears.
export function updateBalls(hands: Record<HandKey, HandInput>, cw: number, ch: number) {
  const radius = ballRadiusPx(cw, ch)

  for (const key of ['left', 'right'] as const) {
    const hand = hands[key]
    const grabbing = hand.present && hand.grab

    if (grabbing && !wasGrabbing[key] && !balls.some((b) => b.heldBy === key)) {
      let best: Ball | null = null
      let bestDist = radius * GRAB_REACH
      for (const ball of balls) {
        if (ball.heldBy) continue
        const d = Math.hypot(hand.palm.x - ball.x * cw, hand.palm.y - ball.y * ch)
        if (d <= bestDist) {
          best = ball
          bestDist = d
        }
      }
      if (best) best.heldBy = key
    }

    for (const ball of balls) {
      if (ball.heldBy !== key) continue
      if (grabbing) {
        ball.x = Math.min(Math.max(hand.palm.x / cw, EDGE_MARGIN), 1 - EDGE_MARGIN)
        ball.y = Math.min(Math.max(hand.palm.y / ch, EDGE_MARGIN), 1 - EDGE_MARGIN)
      } else {
        ball.heldBy = null
      }
    }

    wasGrabbing[key] = grabbing
  }
}
