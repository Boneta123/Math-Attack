// Enemy ships sail down the lanes from the horizon to the shore. A cannon shot with the same
// number sinks the ship; any other number is consumed and the ship sails on.
import { LANES, LANE_END_Y, notifyShots, shots } from './cannons'

// Normalized screen y of the waterline (two thirds of the way down, matching the beach shader).
export const SHORE_Y = 2 / 3
// Seconds a ship takes to sail from the horizon to the shore.
export const SHIP_TRAVEL_TIME = 40
// Seconds between spawns: one ship at a time keeps the water readable for now.
const SPAWN_INTERVAL = 12
// Highest number written on a ship.
const MAX_SHIP_VALUE = 9
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

// Fires once when a ship reaches the shore.
// TODO: wire to lives / score.
let landedCallback: (ship: Ship) => void = () => {}
export const onShipLanded = (callback: (ship: Ship) => void) => {
  landedCallback = callback
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
export const shipScale = (ship: Ship) => depthScale(ship.y)

// Per-frame step (dt in seconds). Call after stepCannons so shots are already moved.
export function stepShips(dt: number) {
  dt = Math.min(dt, 0.1)
  let changed = false

  spawnTimer -= dt
  if (spawnTimer <= 0) {
    spawnTimer = SPAWN_INTERVAL
    const free = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !ships.some((s) => s.lane === lane))
    if (free.length > 0) {
      const lane = free[Math.floor(Math.random() * free.length)]
      const value = 1 + Math.floor(Math.random() * MAX_SHIP_VALUE)
      ships.push({ id: nextShipId++, lane, value, y: LANE_END_Y, prevY: LANE_END_Y, age: 0, state: 'sailing', sunkFor: 0, flash: 0, blast: false })
      changed = true
    }
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
    ship.y = LANE_END_Y + (SHORE_Y - LANE_END_Y) * shipProgress(ship) ** SHIP_Y_EASE
    if (ship.age >= SHIP_TRAVEL_TIME) {
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
  let shotsChanged = false
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    const shotDepth = depthOf(shot.y)
    const shotPrevDepth = depthOf(shot.prevY)
    const ship = ships.find(
      (s) =>
        s.state === 'sailing' &&
        s.lane === shot.lane &&
        shotPrevDepth <= depthOf(s.prevY) &&
        shotDepth >= depthOf(s.y),
    )
    if (!ship) continue
    shots.splice(i, 1)
    shotsChanged = true
    if (ship.value === shot.value) {
      ship.state = 'sinking'
      ship.sunkFor = 0
    } else {
      ship.flash = FLASH_TIME
    }
  }
  if (shotsChanged) notifyShots()
  if (changed) notifyShips()
}
