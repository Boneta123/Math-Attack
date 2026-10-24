import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cannonLayout } from './cannons'
import { FLASH_TIME, SINK_TIME, getShipsVersion, shipScale, ships, subscribeShips, type Ship } from './ships'

// Local ship units: 1 = one grid column. The group is scaled every frame by the lane width and the
// ship's apparent size, so even the biggest ship fits inside its lane. The model faces the camera
// (+z) and is tilted back a little so the deck shows.

const SPARKS = 16
const SMOKE = 6
const TILT = 0.3

// Number signs are painted onto canvases, cached per number like the cannon ball textures.
const signCache = new Map<string, THREE.CanvasTexture>()
function signTexture(value: number, kind: 'plate' | 'sail') {
  const key = `${kind}-${value}`
  let texture = signCache.get(key)
  if (!texture) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const g = canvas.getContext('2d')!
    g.fillStyle = kind === 'plate' ? '#2a1d12' : '#e4dcc4'
    g.fillRect(0, 0, size, size)
    g.strokeStyle = kind === 'plate' ? '#c9a24a' : '#7a6a4a'
    g.lineWidth = 8
    g.strokeRect(6, 6, size - 12, size - 12)
    g.font = `bold ${String(value).length > 1 ? 70 : 92}px Georgia, serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = kind === 'plate' ? '#f1e6c8' : '#2a1d12'
    g.fillText(String(value), size / 2, size / 2 + 4)
    texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    signCache.set(key, texture)
  }
  return texture
}

function ShipUnit({ ship }: { ship: Ship }) {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  const burst = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const sparks = useRef<THREE.Points>(null)
  const smoke = useRef<THREE.Points>(null)

  const { hull, wood, plate, sail, sparkGeometry, smokeGeometry, sparkVel, smokeVel } = useMemo(() => {
    const standard = (color: string, map?: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ color, map, roughness: 0.8, metalness: 0.1, transparent: true, side: THREE.DoubleSide })
    const velocities = (n: number, minSpeed: number, maxSpeed: number) =>
      Array.from({ length: n }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
        return [Math.cos(angle) * speed, Math.sin(angle) * speed] as const
      })
    const make = (n: number) => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      return geometry
    }
    return {
      hull: standard('#4a3322'),
      wood: standard('#6b4a2e'),
      plate: standard('#ffffff', signTexture(ship.value, 'plate')),
      sail: standard('#ffffff', signTexture(ship.value, 'sail')),
      sparkGeometry: make(SPARKS),
      smokeGeometry: make(SMOKE),
      sparkVel: velocities(SPARKS, 0.8, 2.4),
      smokeVel: velocities(SMOKE, 0.2, 0.8),
    }
  }, [ship.value])

  useFrame(({ clock }) => {
    const g = group.current
    const m = model.current
    if (!g || !m) return
    const layout = cannonLayout(size.width, size.height)
    const unit = layout.cell * (viewport.height / size.height) // one lane in world units
    const t = clock.elapsedTime + ship.id * 1.7
    const sunk = ship.state === 'sinking' ? Math.min(ship.sunkFor / SINK_TIME, 1) : 0

    g.position.set(
      (layout.laneXAt(ship.lane, ship.y) - 0.5) * viewport.width,
      (0.5 - ship.y) * viewport.height + Math.sin(t * 1.6) * 0.03 * unit * shipScale(ship),
      0.2,
    )
    g.scale.setScalar(unit * shipScale(ship))

    // Sea motion, then the sinking: tip over and slide under while fading out.
    m.rotation.set(TILT + sunk * 0.5, 0, Math.sin(t * 1.1) * 0.06 + sunk * 0.9)
    m.position.y = -sunk * 0.6
    const opacity = 1 - sunk * sunk
    const red = ship.flash > 0 ? ship.flash / FLASH_TIME : 0
    for (const material of [hull, wood, plate, sail]) {
      material.opacity = opacity
      material.emissive.setRGB(red, 0, 0)
    }

    // Explosion burst at the moment the ship is hit.
    const b = burst.current
    if (!b) return
    b.visible = ship.state === 'sinking'
    if (!b.visible) return
    const life = sunk
    if (flash.current) {
      const fast = Math.min(ship.sunkFor / 0.25, 1)
      flash.current.visible = fast < 1
      flash.current.scale.setScalar(0.3 + 0.9 * Math.sqrt(fast))
      ;(flash.current.material as THREE.MeshBasicMaterial).opacity = 1 - fast
    }
    const place = (points: THREE.Points | null, velocities: readonly (readonly [number, number])[], drag: number) => {
      if (!points) return
      const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute
      const travel = (1 - Math.exp(-drag * ship.sunkFor)) / drag
      velocities.forEach(([vx, vy], i) => attr.setXYZ(i, vx * travel, vy * travel, 0))
      attr.needsUpdate = true
    }
    place(sparks.current, sparkVel, 3)
    place(smoke.current, smokeVel, 2)
    if (sparks.current) {
      const material = sparks.current.material as THREE.PointsMaterial
      material.size = unit * 0.1 * (1 - 0.6 * life)
      material.opacity = Math.max(0, 1 - life * life * 1.4)
    }
    if (smoke.current) {
      const material = smoke.current.material as THREE.PointsMaterial
      material.size = unit * (0.3 + 0.5 * life)
      material.opacity = 0.45 * (1 - life)
    }
  })

  return (
    <group ref={group}>
      <group ref={model}>
        {/* Tapered hull: a four-sided frustum, wider on top, stretched into a ship's length */}
        <mesh material={hull} scale={[1, 1, 1.6]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.34, 0.26, 0.26, 4]} />
        </mesh>
        {/* Number plate on the bow-facing side of the hull (angled to follow its slope) */}
        <mesh material={plate} position={[0, 0, 0.35]} rotation={[0.337, 0, 0]}>
          <planeGeometry args={[0.3, 0.22]} />
        </mesh>
        <mesh material={wood} position={[0, 0.15, 0]}>
          <boxGeometry args={[0.46, 0.04, 0.72]} />
        </mesh>
        <mesh material={wood} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.8, 8]} />
        </mesh>
        <mesh material={sail} position={[0, 0.58, 0.05]}>
          <planeGeometry args={[0.4, 0.5]} />
        </mesh>
      </group>
      <group ref={burst} visible={false} position={[0, 0, 0.3]}>
        <mesh ref={flash}>
          <sphereGeometry args={[0.5, 20, 20]} />
          <meshBasicMaterial color="#ffd27a" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <points ref={smoke} geometry={smokeGeometry} frustumCulled={false}>
          <pointsMaterial color="#8d969b" transparent depthWrite={false} sizeAttenuation />
        </points>
        <points ref={sparks} geometry={sparkGeometry} frustumCulled={false}>
          <pointsMaterial color="#ffae3d" transparent blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
        </points>
      </group>
    </group>
  )
}

export default function Ships() {
  useSyncExternalStore(subscribeShips, getShipsVersion)
  return (
    <>
      {ships.map((ship) => (
        <ShipUnit key={ship.id} ship={ship} />
      ))}
    </>
  )
}
