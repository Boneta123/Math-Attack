import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ballRadiusPx, balls } from './balls'
import {
  EXPLOSION_TIME,
  FIRE_DELAY,
  LANES,
  cannonLayout,
  cannons,
  getShotsVersion,
  shotProgress,
  shots,
  stepCannons,
  subscribeShots,
} from './cannons'
import { getIronBase, ironTextureFor } from './ironTextures'
import { SHOT_SIZE, depthScale, stepShips } from './ships'

// Local cannon units: 1 = one grid column. The group is scaled to the tile size every frame, so
// the cannons always fit their column. The model is built with the barrel pointing down (-y) and
// the group is rotated half a turn, so on screen it points up the lane; its opening is about 0.45
// from the tile center, which is where cannonLayout.muzzleY puts the explosion and shots.

const IRON = { color: '#3b3f44', metalness: 0.8, roughness: 0.42 } as const
const DARK_IRON = { color: '#26292d', metalness: 0.7, roughness: 0.55 } as const

const WOOD = { color: '#5a4028', metalness: 0.05, roughness: 0.85 } as const

// How far the barrel is raised out of the tile plane (0 = lying flat, PI / 2 = pointing straight into the screen).
const STAND_TILT = (60 * Math.PI) / 180

const SPARKS = 18
const SMOKE = 8

function CannonUnit({ lane }: { lane: number }) {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const barrel = useRef<THREE.Group>(null)
  const rim = useRef<THREE.MeshBasicMaterial>(null)
  const plate = useRef<THREE.MeshStandardMaterial>(null)
  const rimMesh = useRef<THREE.Mesh>(null)
  const plateMesh = useRef<THREE.Mesh>(null)
  // 0..1 fade of the tile grid: only visible while a held ball hovers over it.
  const tileShow = useRef(0)
  const lamp = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef<THREE.Mesh>(null)
  const { bump } = getIronBase()

  useFrame((_, delta) => {
    const g = group.current
    const b = barrel.current
    if (!g || !b) return
    const layout = cannonLayout(size.width, size.height)
    const k = viewport.height / size.height
    g.position.set((layout.laneX(lane) - 0.5) * viewport.width, (0.5 - layout.centerY) * viewport.height, 0)
    g.scale.setScalar(layout.cell * k)

    const cannon = cannons[lane]
    const loaded = cannon.value !== null
    const p = loaded ? Math.min(cannon.charge / FIRE_DELAY, 1) : 0

    // Point the barrel along its lane. The group is flipped half a turn, so a clockwise turn of
    // `aim` on screen is a rotation of -aim here.
    const aim = layout.aim(lane)
    b.rotation.z = -aim

    // Recoil: the barrel kicks back (toward the player, along its own axis) after firing.
    const recoil = 0.1 * Math.max(0, 1 - cannon.sinceFire / 0.25) ** 2
    b.position.set(Math.sin(aim) * recoil, Math.cos(aim) * recoil, 0)

    // The lamp blinks faster as the shot gets close.
    const blink = loaded ? 0.55 + 0.45 * Math.sin(cannon.charge * (8 + 22 * p)) : 0
    if (lamp.current) {
      lamp.current.emissiveIntensity = loaded ? 0.6 + 2.6 * blink * (0.4 + 0.6 * p) : 0
      lamp.current.emissive.set(p > 0.7 ? '#ff4a1c' : '#ffb02e')
    }
    if (glow.current) {
      const material = glow.current.material as THREE.MeshBasicMaterial
      material.opacity = loaded ? 0.15 + 0.5 * blink : 0
      glow.current.scale.setScalar(1 + 1.2 * p)
    }

    // Tile (outline and plate) fades in while a held ball is over it and out when it leaves.
    const target = cannon.hover ? 1 : 0
    tileShow.current += (target - tileShow.current) * Math.min(1, delta * 14)
    if (Math.abs(target - tileShow.current) < 0.01) tileShow.current = target
    const show = tileShow.current
    if (rim.current) rim.current.opacity = 0.85 * show
    if (plate.current) plate.current.opacity = show
    if (rimMesh.current) rimMesh.current.visible = show > 0
    if (plateMesh.current) plateMesh.current.visible = show > 0
  })

  return (
    <group ref={group} rotation={[0, 0, Math.PI]}>
      {/* Tile: dark plate with a glowing outline behind it, shown only while a held ball hovers */}
      <mesh ref={rimMesh} position={[0, 0, -0.2]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={rim} color="#7dffb0" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={plateMesh} position={[0, 0, -0.14]} visible={false}>
        <boxGeometry args={[0.92, 0.92, 0.08]} />
        <meshStandardMaterial ref={plate} {...DARK_IRON} bumpMap={bump} bumpScale={1.5} transparent opacity={0} />
      </mesh>

      {/* Stilts: two legs from the breech down to the ground with a crossbar, foot pads and a
          soft shadow. Local +y is screen-down; the frame stays put while the barrel aims. */}
      <mesh position={[0, 0.62, -0.1]} scale={[1, 0.45, 1]}>
        <circleGeometry args={[0.36, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.42, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.44, 12]} />
            <meshStandardMaterial {...WOOD} />
          </mesh>
          <mesh position={[x, 0.63, 0]}>
            <boxGeometry args={[0.16, 0.05, 0.14]} />
            <meshStandardMaterial {...DARK_IRON} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.46, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.38, 10]} />
        <meshStandardMaterial {...WOOD} />
      </mesh>

      <group ref={barrel}>
        {/* Stand the barrel up: tilt it about the breech so the muzzle points into the screen, toward the water. */}
        <group position={[0, 0.2, 0.1]} rotation={[STAND_TILT, 0, 0]}>
          <group position={[0, -0.2, 0]}>
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.24, 32, 32]} />
              <meshStandardMaterial {...IRON} bumpMap={bump} bumpScale={2} />
            </mesh>
            <mesh position={[0, -0.11, 0]}>
              <cylinderGeometry args={[0.2, 0.15, 0.62, 32]} />
              <meshStandardMaterial {...IRON} bumpMap={bump} bumpScale={2} />
            </mesh>
            <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.185, 0.03, 12, 32]} />
              <meshStandardMaterial {...DARK_IRON} />
            </mesh>
            <mesh position={[0, -0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.16, 0.045, 12, 32]} />
              <meshStandardMaterial {...DARK_IRON} />
            </mesh>
            {/* Dark bore inside the muzzle */}
            <mesh position={[0, -0.425, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 24]} />
              <meshBasicMaterial color="#050505" />
            </mesh>
          </group>
        </group>
      </group>

      {/* Charge lamp on the shoulder of the tile */}
      <mesh position={[0.33, 0.33, 0.1]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial ref={lamp} color="#3a2a14" emissive="#ffb02e" emissiveIntensity={0} />
      </mesh>
      <mesh ref={glow} position={[0.33, 0.33, 0.12]}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshBasicMaterial color="#ffb02e" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

// Muzzle blast: a bright flash, a burst of sparks and a puff of smoke, all driven by how long ago
// the cannon last fired. World-space (not scaled with the cannon), sized from the tile instead.
function Explosion({ lane }: { lane: number }) {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const sparks = useRef<THREE.Points>(null)
  const smoke = useRef<THREE.Points>(null)

  const { sparkGeometry, smokeGeometry, sparkVel, smokeVel } = useMemo(() => {
    // Directions fan out mostly up the lane, with a few spraying sideways.
    const velocities = (n: number, minSpeed: number, maxSpeed: number, spread: number) =>
      Array.from({ length: n }, () => {
        const angle = Math.PI / 2 + (Math.random() - 0.5) * spread
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
        return [Math.cos(angle) * speed, Math.sin(angle) * speed] as const
      })
    const make = (n: number) => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      return geometry
    }
    return {
      sparkGeometry: make(SPARKS),
      smokeGeometry: make(SMOKE),
      sparkVel: velocities(SPARKS, 1.6, 4.2, 2.4),
      smokeVel: velocities(SMOKE, 0.3, 1.1, 1.6),
    }
  }, [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = cannons[lane].sinceFire
    g.visible = t < EXPLOSION_TIME
    if (!g.visible) return

    const layout = cannonLayout(size.width, size.height)
    const unit = layout.cell * (viewport.height / size.height) // one cell in world units
    const muzzle = layout.muzzle(lane)
    g.position.set((muzzle.x - 0.5) * viewport.width, (0.5 - muzzle.y) * viewport.height, 0.4)
    // Spray along the barrel: the burst is built pointing up, so turn it clockwise by the aim.
    g.rotation.z = -layout.aim(lane)

    const life = t / EXPLOSION_TIME
    if (flash.current) {
      const fast = Math.min(t / 0.28, 1)
      flash.current.visible = fast < 1
      flash.current.scale.setScalar(unit * (0.25 + 0.95 * Math.sqrt(fast)))
      ;(flash.current.material as THREE.MeshBasicMaterial).opacity = 1 - fast
    }

    const place = (points: THREE.Points | null, velocities: readonly (readonly [number, number])[], drag: number) => {
      if (!points) return
      const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute
      // Distance covered with exponential drag: v * (1 - e^(-drag t)) / drag.
      const travel = (1 - Math.exp(-drag * t)) / drag
      velocities.forEach(([vx, vy], i) => attr.setXYZ(i, vx * travel * unit, vy * travel * unit, 0))
      attr.needsUpdate = true
    }
    place(sparks.current, sparkVel, 4)
    place(smoke.current, smokeVel, 2.5)

    if (sparks.current) {
      const material = sparks.current.material as THREE.PointsMaterial
      material.size = unit * 0.11 * (1 - 0.6 * life)
      material.opacity = Math.max(0, 1 - life * life * 1.4)
    }
    if (smoke.current) {
      const material = smoke.current.material as THREE.PointsMaterial
      material.size = unit * (0.25 + 0.5 * life)
      material.opacity = 0.4 * (1 - life)
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={flash}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial color="#ffd27a" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points ref={smoke} geometry={smokeGeometry} frustumCulled={false}>
        <pointsMaterial color="#8d969b" transparent depthWrite={false} sizeAttenuation />
      </points>
      <points ref={sparks} geometry={sparkGeometry} frustumCulled={false}>
        <pointsMaterial color="#ffae3d" transparent blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}

// Balls in flight up their lanes along the same center line as the ships, drawn at the same
// depthScale as a ship at that height (times SHOT_SIZE, so a ball is always smaller than a ship at
// the same depth), shrinking as they fly away into the distance.
function Shots() {
  const { viewport, size } = useThree()
  const { bump } = getIronBase()
  useSyncExternalStore(subscribeShots, getShotsVersion)
  const radius = (ballRadiusPx(size.width, size.height) / size.height) * viewport.height
  const layout = cannonLayout(size.width, size.height)
  const unit = layout.cell * (viewport.height / size.height) // one lane in world units, like ships
  const meshes = useMemo(() => new Map<number, THREE.Mesh>(), [])
  const materials = useMemo(() => new Map<number, THREE.MeshStandardMaterial>(), [])

  useFrame(() => {
    for (const shot of shots) {
      const mesh = meshes.get(shot.id)
      const material = materials.get(shot.id)
      if (!mesh || !material) continue
      const p = shotProgress(shot)
      mesh.position.set((layout.laneXAt(shot.lane, shot.y) - 0.5) * viewport.width, (0.5 - shot.y) * viewport.height, 0.3)
      // Ball diameter = SHOT_SIZE of the ship's width (about one lane at depthScale 1) at this depth.
      mesh.scale.setScalar((unit * depthScale(shot.y) * SHOT_SIZE) / (2 * radius))
      material.emissiveIntensity = 0.7 * (1 - p) + 0.15
    }
  })

  const track = <T,>(store: Map<number, T>, id: number) => (item: T | null) => {
    if (item) store.set(id, item)
    else store.delete(id)
  }

  return (
    <>
      {shots.map((shot) => (
        <mesh key={shot.id} ref={track(meshes, shot.id)}>
          <sphereGeometry args={[radius, 48, 48]} />
          <meshStandardMaterial
            ref={track(materials, shot.id)}
            map={ironTextureFor(shot.value)}
            bumpMap={bump}
            bumpScale={2}
            metalness={0.7}
            roughness={0.45}
            emissive="#ff9a2a"
            emissiveIntensity={0.85}
          />
        </mesh>
      ))}
    </>
  )
}

export default function Cannons() {
  const { size } = useThree()

  useFrame((_, delta) => {
    const held = balls.filter((b) => b.heldBy !== null)
    stepCannons(delta, held, size.width, size.height)
    stepShips(delta)
  })

  return (
    <>
      {Array.from({ length: LANES }, (_, lane) => (
        <CannonUnit key={`cannon-${lane}`} lane={lane} />
      ))}
      {Array.from({ length: LANES }, (_, lane) => (
        <Explosion key={`boom-${lane}`} lane={lane} />
      ))}
      <Shots />
    </>
  )
}
