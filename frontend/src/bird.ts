// A bird flies in from the enemy lines, lands, and blocks the view of the three lanes on one side.
// It is purely visual: ships and shots keep working underneath. The only cure is the OPPOSITE hand:
// open a hand fully (a big scythe replaces the glove) and swing its blade into the bird.
import { cannonLayout } from './cannons'
import { ACTION_BUFFER_MS, displayToScreen, handAnchors } from './handTracking'

export type BirdSide = 'left' | 'right'
type HandKey = 'left' | 'right'

// Seconds until the first bird, and between one bird leaving and the next one launching.
const FIRST_BIRD_DELAY = 15
export const BIRD_INTERVAL = 30
// Seconds the bird spends flying in before it lands.
export const BIRD_FLIGHT_TIME = 12
// Seconds the bird takes to vanish once it has been swept away.
export const BIRD_LEAVE_TIME = 0.7
// Sickle size in lanes, and how far along the hand (in sickle sizes) its blade sits from the palm.
export const SICKLE_SIZE = 1.3
const BLADE_REACH = 0.72
// Half width and height of the perched bird's body in lanes: the sickle blade must touch inside it.
const BIRD_HIT_HALF_WIDTH = 1.5
const BIRD_HIT_HALF_HEIGHT = 1.1

// Lanes hidden by a bird perched on each side (the middle lane is shared).
export const BLOCKED_LANES: Record<BirdSide, number[]> = { left: [0, 1, 2], right: [2, 3, 4] }
// Normalized screen position of a perched bird: centered on the middle of its three lanes.
// It lands well out over the water, a good distance from the player.
export const perchPosition = (side: BirdSide) => ({ x: side === 'right' ? 4 / 6 : 2 / 6, y: 0.25 })

export type Bird = {
  side: BirdSide
  state: 'flying' | 'perched' | 'charging' | 'leaving'
  // Seconds since launch, perched, charging at the player, and leaving.
  age: number
  perchedFor: number
  chargeFor: number
  leaveFor: number
}

// A perched bird that is still there after this many seconds charges at the player.
export const BIRD_PERCH_LIMIT = 10
// Seconds the charge takes, from the perch to the player.
export const BIRD_CHARGE_TIME = 1.5

let bird: Bird | null = null
export const getBird = () => bird

let spawnTimer = FIRST_BIRD_DELAY

// Fires once when a charging bird reaches the player (lives.ts takes a life).
let hitCallback: (bird: Bird) => void = () => {}
export const onBirdHit = (callback: (bird: Bird) => void) => {
  hitCallback = callback
}

// Sends any bird away and restarts the wait for the first one, for a new game.
export function resetBird() {
  bird = null
  spawnTimer = FIRST_BIRD_DELAY
}

// The hand that can cure a bird: the one on the opposite side of the screen.
export const cureHand = (side: BirdSide): HandKey => (side === 'right' ? 'left' : 'right')

// Hands showing the scythe: any hand that has held an open palm (all four fingers out) long enough, bird or no bird.
let sickleHands: HandKey[] = []
export const getSickleHands = () => sickleHands

const thumbSince: Record<HandKey, number | null> = { left: null, right: null }

// Per-frame step (dt in seconds) for a game area of cw x ch pixels.
export function stepBird(dt: number, cw: number, ch: number, now = performance.now()) {
  dt = Math.min(dt, 0.1)

  sickleHands = []
  for (const key of ['left', 'right'] as const) {
    const hand = handAnchors[key]
    if (!(hand.present && hand.gesture === 'Open_Palm')) {
      thumbSince[key] = null
      continue
    }
    thumbSince[key] ??= now
    if (now - thumbSince[key]! >= ACTION_BUFFER_MS) sickleHands.push(key)
  }

  if (!bird) {
    spawnTimer -= dt
    if (spawnTimer <= 0) {
      bird = { side: Math.random() < 0.5 ? 'left' : 'right', state: 'flying', age: 0, perchedFor: 0, chargeFor: 0, leaveFor: 0 }
    }
    return
  }

  if (bird.state === 'flying') {
    bird.age += dt
    if (bird.age >= BIRD_FLIGHT_TIME) bird.state = 'perched'
    return
  }

  if (bird.state === 'leaving') {
    bird.leaveFor += dt
    if (bird.leaveFor >= BIRD_LEAVE_TIME) {
      bird = null
      spawnTimer = BIRD_INTERVAL
    }
    return
  }

  if (bird.state === 'charging') {
    bird.chargeFor += dt
    if (bird.chargeFor >= BIRD_CHARGE_TIME) {
      hitCallback(bird)
      bird = null
      spawnTimer = BIRD_INTERVAL
    }
    return
  }

  // Perched: only the sickle of the opposite hand can cure it.
  const key = cureHand(bird.side)
  if (sickleHands.includes(key)) {
    // Swing: the blade sits ahead of the palm along the hand (wrist -> palm). Touching the bird cures it.
    const hand = handAnchors[key]
    const palm = displayToScreen(hand.palm, cw, ch)
    const wrist = displayToScreen(hand.wrist, cw, ch)
    const length = Math.hypot(palm.x - wrist.x, palm.y - wrist.y) || 1
    const { cell } = cannonLayout(cw, ch)
    const reach = BLADE_REACH * SICKLE_SIZE * cell
    const blade = { x: palm.x + ((palm.x - wrist.x) / length) * reach, y: palm.y + ((palm.y - wrist.y) / length) * reach }
    const perch = perchPosition(bird.side)
    const dx = (blade.x - perch.x * cw) / (BIRD_HIT_HALF_WIDTH * cell)
    const dy = (blade.y - perch.y * ch) / (BIRD_HIT_HALF_HEIGHT * cell)
    if (dx * dx + dy * dy <= 1) {
      bird.state = 'leaving'
      return
    }
  }

  // Left alone too long, the bird stops waiting and flies into the player.
  bird.perchedFor += dt
  if (bird.perchedFor >= BIRD_PERCH_LIMIT) bird.state = 'charging'
}
