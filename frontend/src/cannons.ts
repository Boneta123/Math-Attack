// One cannon at the top of each column (lane). Drop a ball on a cannon tile and it is swallowed,
// the cannon's lamp charges for FIRE_DELAY seconds, then it fires the ball down the lane.

// Same as the ball grid's column count, so every cannon sits above one grid column.
export const LANES = 10
// Seconds from placing the ball on the tile to the shot leaving the barrel.
export const FIRE_DELAY = 1.5
// Seconds a shot takes to travel from the muzzle to the end of the lane.
const SHOT_TRAVEL_TIME = 1.4
// Normalized screen y where a shot disappears (just above the shoreline, 2/3 down).
const LANE_END_Y = 0.64
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
  // Center in normalized screen space; y runs from the muzzle down to LANE_END_Y.
  y: number
  startY: number
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
function notifyShots() {
  shotsVersion++
  listeners.forEach((listener) => listener())
}

// Cannon geometry for a game area of cw x ch pixels. Each tile is one grid column wide and square,
// along the top edge; the barrel points down the lane.
export function cannonLayout(cw: number, ch: number) {
  const cell = cw / LANES
  return {
    cell, // tile size in pixels
    centerY: (cell * 0.55) / ch, // normalized y of the tile center
    muzzleY: (cell * 1.0) / ch, // normalized y of the barrel opening
    laneX: (lane: number) => (lane + 0.5) / LANES, // normalized x of a lane
  }
}

// Which free cannon tile (if any) the point (nx, ny), in normalized screen space, is over.
function cannonUnder(nx: number, ny: number, cw: number, ch: number): number | null {
  const { cell } = cannonLayout(cw, ch)
  if (ny * ch > cell * 1.1) return null
  const lane = Math.floor(nx * LANES)
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
  const { muzzleY } = cannonLayout(cw, ch)

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
    shots.push({ id: nextShotId++, value: cannon.value, lane, y: muzzleY, startY: muzzleY, age: 0 })
    cannon.value = null
    cannon.charge = 0
    cannon.sinceFire = 0
    changed = true
  })

  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    shot.age += dt
    const t = shot.age / SHOT_TRAVEL_TIME
    if (t >= 1) {
      shots.splice(i, 1)
      changed = true
    } else {
      shot.y = shot.startY + (LANE_END_Y - shot.startY) * t
    }
  }
  if (changed) notifyShots()
}

// 0 at the muzzle, 1 at the end of the lane. The renderer scales the ball up with it so the
// shot looks like it is coming toward the player.
export const shotProgress = (shot: Shot) => Math.min(shot.age / SHOT_TRAVEL_TIME, 1)
