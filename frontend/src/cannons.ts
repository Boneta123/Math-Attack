// Five cannons, each sitting in the gap between two neighbouring balls of the single ball row (a
// lane per cannon). Drop a ball on a cannon tile and it is swallowed, the cannon's lamp charges for FIRE_DELAY seconds, then it fires
// the ball up the lane, away from the player.

// Number of ball columns in the ball row; one more than the cannons, so there is a cannon between
// every pair of neighbouring ball columns.
export const BALL_COLS = 6
export const LANES = BALL_COLS - 1
// Normalized screen y of the center of the ball row (the cannons are placed relative to it).
export const BALL_ROW_Y = 0.72
// Seconds from placing the ball on the tile to the shot leaving the barrel.
export const FIRE_DELAY = 1.5
// Seconds a shot takes to travel from the muzzle to the end of the lane.
const SHOT_TRAVEL_TIME = 1.6
// Normalized screen y where a shot disappears (near the horizon, out over the water).
export const LANE_END_Y = 0.12
// How far the lanes converge toward the middle of the screen at LANE_END_Y: 1 = parallel lanes,
// 0 = every lane meets at one point. Below 1 the cannons fan inward and fire out across the water.
// Kept at 1 so every cannon points straight up its lane, like the middle one, and ships come straight down.
const LANE_CONVERGE = 1
// Muzzle explosion lifetime in seconds.
export const EXPLOSION_TIME = 0.55

export type Cannon = {
  // Number of the ball waiting to fire, or null while the cannon is empty.
  value: number | null
  // Seconds since the ball was placed (only meaningful while loaded).
  charge: number
  // A held ball is hovering over the tile and would be loaded if released now.
  hover: boolean
  // Seconds since the last shot left the barrel (for the explosion and recoil).
  sinceFire: number
}

export type Shot = {
  id: number
  value: number
  lane: number
  // Center in normalized screen space; runs from the muzzle to the end of the lane.
  x: number
  y: number
  // Where y was before the latest step (for crossing tests against ships).
  prevY: number
  startX: number
  startY: number
  endX: number
  age: number
}

export const cannons: Cannon[] = Array.from({ length: LANES }, () => ({
  value: null,
  charge: 0,
  hover: false,
  sinceFire: Infinity,
}))

// Mutated in place like balls; the renderer subscribes to additions and removals.
export const shots: Shot[] = []
let nextShotId = 1

let shotsVersion = 0
const listeners = new Set<() => void>()
export const subscribeShots = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getShotsVersion = () => shotsVersion
export function notifyShots() {
  shotsVersion++
  listeners.forEach((listener) => listener())
}

// Cannon geometry for a game area of cw x ch pixels. Each tile is one grid column wide and square,
// one cell above the ball row and centered on the boundary between two ball columns; each barrel points along its lane toward the far end of the water.
export function cannonLayout(cw: number, ch: number) {
  const cell = cw / BALL_COLS
  const centerY = BALL_ROW_Y - cell / ch // normalized y of the tile center
  const laneX = (lane: number) => (lane + 1) / BALL_COLS // normalized x of a lane (tile center)
  const laneEndX = (lane: number) => 0.5 + (laneX(lane) - 0.5) * LANE_CONVERGE
  // Angle in radians from straight up, positive = pointing right on screen. Computed in pixels so
  // the barrel and the shot agree on the direction whatever the aspect ratio.
  const aim = (lane: number) => Math.atan2((laneEndX(lane) - laneX(lane)) * cw, (centerY - LANE_END_Y) * ch)
  // Barrel opening: 0.45 of a cell from the tile center, along the aim direction.
  const muzzle = (lane: number) => {
    const a = aim(lane)
    return { x: laneX(lane) + (Math.sin(a) * cell * 0.45) / cw, y: centerY - (Math.cos(a) * cell * 0.45) / ch }
  }
  // Normalized x of the lane's center line at screen height y (the line shots and ships follow).
  const laneXAt = (lane: number, y: number) =>
    laneEndX(lane) + (laneX(lane) - laneEndX(lane)) * ((y - LANE_END_Y) / (centerY - LANE_END_Y))
  return { cell, centerY, laneX, laneEndX, laneXAt, aim, muzzle }
}

// Which free cannon tile (if any) the point (nx, ny), in normalized screen space, is over.
function cannonUnder(nx: number, ny: number, cw: number, ch: number): number | null {
  const { cell, centerY } = cannonLayout(cw, ch)
  if (Math.abs(ny - centerY) * ch > cell * 0.65) return null
  const lane = Math.floor(nx * BALL_COLS - 0.5)
  if (lane < 0 || lane >= LANES) return null
  return cannons[lane].value === null ? lane : null
}

// Called when a ball is released at (nx, ny). If it is over a free cannon tile the cannon takes
// it (the ball despawns) and this returns true.
export function tryLoadCannon(value: number, nx: number, ny: number, cw: number, ch: number): boolean {
  const lane = cannonUnder(nx, ny, cw, ch)
  if (lane === null) return false
  const cannon = cannons[lane]
  cannon.value = value
  cannon.charge = 0
  cannon.hover = false
  return true
}

// Per-frame step (dt in seconds). `held` are the centers of balls currently in a hand, used to
// light up the tile they would land on.
export function stepCannons(dt: number, held: { x: number; y: number }[], cw: number, ch: number) {
  dt = Math.min(dt, 0.1)
  const layout = cannonLayout(cw, ch)

  for (const cannon of cannons) cannon.hover = false
  for (const ball of held) {
    const lane = cannonUnder(ball.x, ball.y, cw, ch)
    if (lane !== null) cannons[lane].hover = true
  }

  let changed = false
  cannons.forEach((cannon, lane) => {
    cannon.sinceFire += dt
    if (cannon.value === null) return
    cannon.charge += dt
    if (cannon.charge < FIRE_DELAY) return
    const muzzle = layout.muzzle(lane)
    shots.push({
      id: nextShotId++,
      value: cannon.value,
      lane,
      x: muzzle.x,
      y: muzzle.y,
      prevY: muzzle.y,
      startX: muzzle.x,
      startY: muzzle.y,
      endX: layout.laneEndX(lane),
      age: 0,
    })
    cannon.value = null
    cannon.charge = 0
    cannon.sinceFire = 0
    changed = true
  })

  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    shot.age += dt
    shot.prevY = shot.y
    const t = shot.age / SHOT_TRAVEL_TIME
    if (t >= 1) {
      shots.splice(i, 1)
      changed = true
    } else {
      shot.x = shot.startX + (shot.endX - shot.startX) * t
      shot.y = shot.startY + (LANE_END_Y - shot.startY) * t
    }
  }
  if (changed) notifyShots()
}

// 0 at the muzzle, 1 at the end of the lane. The renderer shrinks the ball with it so the
// shot looks like it is flying away from the player.
export const shotProgress = (shot: Shot) => Math.min(shot.age / SHOT_TRAVEL_TIME, 1)
