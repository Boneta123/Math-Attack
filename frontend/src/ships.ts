// Enemy ships sail down the lanes from the horizon to the shore. A cannon shot with the same
// number sinks the ship; any other number is consumed and the ship sails on.
import { LANES, LANE_END_Y, notifyShots, shots } from './cannons'

// Normalized screen y of the waterline (two thirds of the way down, matching the beach shader).
export const SHORE_Y = 2 / 3
// Seconds a ship takes to sail from the horizon to the shore.
export const SHIP_TRAVEL_TIME = 14
// Seconds between spawns: one ship at a time keeps the water readable for now.
const SPAWN_INTERVAL = 10
// Highest number written on a ship.
const MAX_SHIP_VALUE = 9
// How close (normalized y) a shot has to get to a ship to hit it.
const HIT_DISTANCE = 0.05
// Seconds a sunk ship takes to go under, and a wrong-number hit flashes red.
export const SINK_TIME = 0.6
export const FLASH_TIME = 0.25

export type Ship = {
  id: number
  lane: number
  value: number
  // Center in normalized screen space, from LANE_END_Y at the horizon down to SHORE_Y.
  y: number
  // Seconds spent sailing.
  age: number
  state: 'sailing' | 'sinking'
  // Seconds since the ship started sinking.
  sunkFor: number
  // Seconds of red flash left after a wrong-number hit.
  flash: number
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
// Apparent size: grows slowly at first and faster near the shore, like something approaching.
export const shipScale = (ship: Ship) => 0.25 + 1.15 * shipProgress(ship) ** 1.8

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
      ships.push({ id: nextShipId++, lane, value, y: LANE_END_Y, age: 0, state: 'sailing', sunkFor: 0, flash: 0 })
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
    ship.y = LANE_END_Y + (SHORE_Y - LANE_END_Y) * shipProgress(ship) ** 1.4
    if (ship.age >= SHIP_TRAVEL_TIME) {
      ships.splice(i, 1)
      changed = true
      landedCallback(ship)
    }
  }

  // Shots against ships in the same lane: a match sinks the ship, a miss is just consumed.
  let shotsChanged = false
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    const ship = ships.find(
      (s) => s.state === 'sailing' && s.lane === shot.lane && Math.abs(s.y - shot.y) <= HIT_DISTANCE,
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
