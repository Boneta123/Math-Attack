// Enemy ships sail down the lanes from the horizon to the shore. A cannon shot with the same
// number sinks the ship; any other number is consumed and the ship sails on.
import { LANES, LANE_END_Y, notifyShots, shots } from './cannons'
import { shipRange, shipSpawnInterval } from './difficulty'
import { addScore } from './score'

// Normalized screen y of the waterline (two thirds of the way down, matching the beach shader).
export const SHORE_Y = 2 / 3
// Seconds a ship takes to sail from the horizon to the shore.
export const SHIP_TRAVEL_TIME = 42
// Ships blow up this many seconds before the end of the SHIP_TRAVEL_TIME timeline, so they are
// destroyed a little short of the shore (the path and speed are still those of a 42 second trip).
const EARLY_EXPLOSION = 10
export const EXPLODE_AGE = SHIP_TRAVEL_TIME - EARLY_EXPLOSION
// Seconds a sunk ship takes to go under, and a wrong-number hit flashes red.
export const SINK_TIME = 0.6
export const FLASH_TIME = 0.25

export type Ship = {
  id: number
  lane: number
  value: number
  // Center in normalized screen space, from LANE_END_Y at the horizon down to SHORE_Y.
  y: number
  // Where y was before the latest step (for crossing tests against shots).
  prevY: number
  // Seconds spent sailing.
  age: number
  state: 'sailing' | 'sinking'
  // Seconds since the ship started sinking.
  sunkFor: number
  // Seconds of red flash left after a wrong-number hit.
  flash: number
  // True when the ship blew up on the shore rather than being sunk by a cannon shot.
  blast: boolean
}

// Mutated in place like shots; the renderer subscribes to additions and removals.
export const ships: Ship[] = []
let nextShipId = 1
let spawnTimer = 1

let shipsVersion = 0
const listeners = new Set<() => void>()
export const subscribeShips = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getShipsVersion = () => shipsVersion
function notifyShips() {
  shipsVersion++
  listeners.forEach((listener) => listener())
}

// Fires once when a ship reaches the shore (lives.ts takes a life).
let landedCallback: (ship: Ship) => void = () => {}
export const onShipLanded = (callback: (ship: Ship) => void) => {
  landedCallback = callback
}

// Clears the water for a new game.
export function resetShips() {
  ships.length = 0
  spawnTimer = 1
  notifyShips()
}

// 0 at the horizon, 1 at the shore.
export const shipProgress = (ship: Ship) => Math.min(ship.age / SHIP_TRAVEL_TIME, 1)
// Distance of a ship from the horizon follows progress ** SHIP_Y_EASE (see stepShips).
const SHIP_Y_EASE = 1.4
// Shared depth axis for ships and shots: 0 at the shore, 1 at the spawn point on the horizon.
export const depthOf = (y: number) => (SHORE_Y - y) / (SHORE_Y - LANE_END_Y)
export const yAtDepth = (d: number) => SHORE_Y - d * (SHORE_Y - LANE_END_Y)
// Apparent size at depth d, in lanes: small at the spawn point, growing faster near the shore,
// like something approaching. Ships and cannon shots both use it, so anything at the same depth
// is drawn at the same size.
export const scaleAtDepth = (d: number) => 0.1 + 1.3 * (1 - Math.min(Math.max(d, 0), 1)) ** (2.2 / SHIP_Y_EASE)
// Cannonball diameter as a fraction of a ship's size at the same depth (kept well under 1).
export const SHOT_SIZE = 0.3
export const depthScale = (y: number) => scaleAtDepth(depthOf(y))
// Screen height of a ship that has been sailing for `age` seconds.
const shipYAtAge = (age: number) =>
  LANE_END_Y + (SHORE_Y - LANE_END_Y) * Math.min(age / SHIP_TRAVEL_TIME, 1) ** SHIP_Y_EASE
export const shipScale = (ship: Ship) => depthScale(ship.y)

// Per-frame step (dt in seconds). Call after stepCannons so shots are already moved.
export function stepShips(dt: number) {
  dt = Math.min(dt, 0.1)
  let changed = false

  // The spawn timer only runs while some lane is free; with every lane occupied it is halted.
  const free = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !ships.some((s) => s.lane === lane))
  if (free.length > 0) spawnTimer -= dt
  if (free.length > 0 && spawnTimer <= 0) {
    spawnTimer = shipSpawnInterval()
    const lane = free[Math.floor(Math.random() * free.length)]
    const { min, max } = shipRange()
    const value = min + Math.floor(Math.random() * (max - min + 1))
    ships.push({ id: nextShipId++, lane, value, y: LANE_END_Y, prevY: LANE_END_Y, age: 0, state: 'sailing', sunkFor: 0, flash: 0, blast: false })
    changed = true
  }

  for (let i = ships.length - 1; i >= 0; i--) {
    const ship = ships[i]
    if (ship.state === 'sinking') {
      ship.sunkFor += dt
      if (ship.sunkFor >= SINK_TIME) {
        ships.splice(i, 1)
        changed = true
      }
      continue
    }
    ship.age += dt
    ship.flash = Math.max(0, ship.flash - dt)
    ship.prevY = ship.y
    ship.y = shipYAtAge(ship.age)
    if (ship.age >= EXPLODE_AGE) {
      // Reached the shore: explode in place, then disappear like a sunk ship.
      ship.state = 'sinking'
      ship.sunkFor = 0
      ship.blast = true
      changed = true
      landedCallback(ship)
    }
  }

  // Shots against ships in the same lane. Shots fly out (depth rising) while ships sail in (depth
  // falling); a hit needs them to reach the same depth point, so the test is that their depths
  // crossed this frame. No distance tolerance, so nothing hits before the two visibly touch.
  // A ship that has already sailed past the muzzle can no longer be crossed by the outbound shot,
  // so a freshly fired shot hits the ship nearest the muzzle on its way to the shore point-blank:
  // a ship can be destroyed anywhere in its lane until it reaches the shore and explodes.
  let shotsChanged = false
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    const shotDepth = depthOf(shot.y)
    const shotPrevDepth = depthOf(shot.prevY)
    const muzzleDepth = depthOf(shot.startY)
    const inLane = ships.filter((s) => s.state === 'sailing' && s.lane === shot.lane)
    let ship: Ship | undefined
    if (shot.fresh) {
      shot.fresh = false
      ship = inLane
        .filter((s) => depthOf(s.y) <= muzzleDepth)
        .sort((a, b) => depthOf(b.y) - depthOf(a.y))[0]
    }
    ship ??= inLane.find((s) => shotPrevDepth <= depthOf(s.prevY) && shotDepth >= depthOf(s.y))
    if (!ship) continue
    shots.splice(i, 1)
    shotsChanged = true
    if (ship.value === shot.value) {
      ship.state = 'sinking'
      ship.sunkFor = 0
      addScore(ship.value)
    } else {
      ship.flash = FLASH_TIME
    }
  }
  if (shotsChanged) notifyShots()
  if (changed) notifyShips()
}
