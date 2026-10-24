import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cannonLayout, LANE_END_Y } from './cannons'
import { displayToScreen, handAnchors } from './handTracking'
import { getLives } from './lives'
import {
  BIRD_CHARGE_TIME,
  BIRD_FLIGHT_TIME,
  BIRD_LEAVE_TIME,
  getBird,
  SICKLE_SIZE,
  getSickleHands,
  perchPosition,
  stepBird,
} from './bird'

// The bird and the sickle sit in front of the cannons, ships and shots (z 0..0.5). Positions are
// enlarged by the matching perspective factor so they land where the screen math says.
const CAMERA_Z = 35.5
const BIRD_Z = 1
const SICKLE_Z = 1.5
const compensation = (z: number) => (CAMERA_Z - z) / CAMERA_Z
// Width of the perched bird in lanes (it covers three lanes), and the local width of its model.
const BIRD_LANES = 3.2
const MODEL_WIDTH = 2.7
// The perched bird is drawn a bit smaller than the lane-wide size so it reads as further away.
const PERCH_SCALE = 0.85
const FEATHERS = 20
// Seconds before landing that the feet start to come out, so the bird visibly drops its talons.
const FEET_OUT_TIME = 1.5

// Glowing orange talons: they only show once the bird has landed, to signal it can be attacked.
function footMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#f0a020',
    emissive: '#ff8a00',
    emissiveIntensity: 0.6,
    roughness: 0.6,
    transparent: true,
  })
}

function Bird() {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  const feathers = useRef<THREE.Points>(null)
  const feet = useRef<THREE.Group>(null)

  const { materials, featherGeometry, featherVel } = useMemo(() => {
    const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: true })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FEATHERS * 3), 3))
    return {
      materials: { body: mat('#3b3f4a'), wing: mat('#2b2e37'), belly: mat('#c9c2b0'), beak: mat('#e0a030'), feet: footMaterial(), eye: mat('#fff7d6') },
      featherGeometry: geometry,
      featherVel: Array.from({ length: FEATHERS }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.8 + Math.random() * 2.2
        return [Math.cos(angle) * speed, Math.sin(angle) * speed] as const
      }),
    }
  }, [])

  useFrame(({ clock }, delta) => {
    if (getLives() > 0) stepBird(delta, size.width, size.height)
    const g = group.current
    const bird = getBird()
    if (!g) return
    g.visible = bird !== null
    if (!bird) return

    const layout = cannonLayout(size.width, size.height)
    const unit = layout.cell * (viewport.height / size.height) // one lane in world units
    const perch = perchPosition(bird.side)
    const flight = Math.min(bird.age / BIRD_FLIGHT_TIME, 1)
    const t = bird.state === 'flying' ? flight : 1
    // Flies in from the horizon above its perch, growing as it approaches, and lands.
    const eased = t * t * (3 - 2 * t)
    const charge = bird.state === 'charging' ? Math.min(bird.chargeFor / BIRD_CHARGE_TIME, 1) : 0
    const rush = charge * charge
    // A charging bird swoops from its perch down to the player's side of the screen, growing huge.
    const x = layout.laneX(2) + (perch.x - layout.laneX(2)) * eased + (0.5 - perch.x) * rush
    const y = LANE_END_Y + (perch.y - LANE_END_Y) * eased + (1.05 - perch.y) * rush
    const grow = (0.12 + 0.88 * eased ** 1.6) * PERCH_SCALE * (1 + 3.5 * rush)
    const leave = bird.state === 'leaving' ? Math.min(bird.leaveFor / BIRD_LEAVE_TIME, 1) : 0
    const comp = compensation(BIRD_Z)
    g.position.set((x - 0.5) * viewport.width * comp, (0.5 - y) * viewport.height * comp, BIRD_Z)
    g.scale.setScalar(((unit * BIRD_LANES) / MODEL_WIDTH) * grow * (1 + 0.15 * leave))

    // Wings flap while flying and settle once perched.
    const flap = bird.state === 'flying' ? Math.sin(clock.elapsedTime * 9) * 0.7 : Math.sin(clock.elapsedTime * 1.5) * 0.06
    if (leftWing.current) leftWing.current.rotation.z = flap
    if (rightWing.current) rightWing.current.rotation.z = -flap

    // Feet unfold from the belly during the last moments of the flight and stay out once landed.
    const out = bird.state === 'flying' ? Math.min(Math.max((bird.age - (BIRD_FLIGHT_TIME - FEET_OUT_TIME)) / FEET_OUT_TIME, 0), 1) : 1
    if (feet.current) {
      feet.current.visible = out > 0
      feet.current.scale.set(1, Math.max(out, 0.001), 1)
    }

    for (const material of Object.values(materials)) material.opacity = 1 - leave * leave
    const f = feathers.current
    if (f) {
      f.visible = leave > 0
      const attr = f.geometry.getAttribute('position') as THREE.BufferAttribute
      const travel = bird.leaveFor
      featherVel.forEach(([vx, vy], i) => attr.setXYZ(i, vx * travel, vy * travel - 0.3 * travel * travel, 0.5))
      attr.needsUpdate = true
      const fm = f.material as THREE.PointsMaterial
      fm.size = unit * 0.25
      fm.opacity = 1 - leave
    }
  })

  const m = materials
  return (
    <group ref={group} visible={false}>
      {/* Body, belly, head, beak and eyes: the bird faces the player */}
      <mesh material={m.body} scale={[1, 0.85, 0.7]}>
        <sphereGeometry args={[0.7, 24, 24]} />
      </mesh>
      <mesh material={m.belly} position={[0, -0.18, 0.28]} scale={[0.7, 0.6, 0.4]}>
        <sphereGeometry args={[0.7, 20, 20]} />
      </mesh>
      <mesh material={m.body} position={[0, 0.62, 0.25]}>
        <sphereGeometry args={[0.38, 20, 20]} />
      </mesh>
      <mesh material={m.beak} position={[0, 0.58, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.35, 12]} />
      </mesh>
      <mesh material={m.eye} position={[-0.15, 0.7, 0.55]}>
        <sphereGeometry args={[0.07, 12, 12]} />
      </mesh>
      <mesh material={m.eye} position={[0.15, 0.7, 0.55]}>
        <sphereGeometry args={[0.07, 12, 12]} />
      </mesh>
      {/* Talons: legs hanging from the belly with three toes each; they pivot at the top and unfold downward */}
      <group ref={feet} position={[0, -0.5, 0.15]} visible={false}>
        {[-0.3, 0.3].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh material={m.feet} position={[0, -0.25, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.5, 8]} />
            </mesh>
            {[-0.14, 0, 0.14].map((toe) => (
              <mesh key={toe} material={m.feet} position={[toe, -0.55, 0.08]} rotation={[Math.PI / 2 + 0.2, 0, -toe * 2]}>
                <coneGeometry args={[0.04, 0.24, 6]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* Wings pivot at the shoulders */}
      <group ref={leftWing} position={[-0.55, 0.15, 0]}>
        <mesh material={m.wing} position={[-0.65, 0, 0]} scale={[1, 0.35, 0.12]}>
          <sphereGeometry args={[0.7, 20, 20]} />
        </mesh>
      </group>
      <group ref={rightWing} position={[0.55, 0.15, 0]}>
        <mesh material={m.wing} position={[0.65, 0, 0]} scale={[1, 0.35, 0.12]}>
          <sphereGeometry args={[0.7, 20, 20]} />
        </mesh>
      </group>
      <points ref={feathers} geometry={featherGeometry} visible={false} frustumCulled={false}>
        <pointsMaterial color="#d8d2c0" transparent depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}

// A large sickle (handle plus curved blade) that replaces the glove on the thumbs-up hand.
function Sickle({ handKey }: { handKey: 'left' | 'right' }) {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = getSickleHands().includes(handKey)
    if (!g.visible) return
    const hand = handAnchors[handKey]
    const layout = cannonLayout(size.width, size.height)
    const unit = layout.cell * (viewport.height / size.height)
    const palm = displayToScreen(hand.palm, size.width, size.height)
    const wrist = displayToScreen(hand.wrist, size.width, size.height)
    const comp = compensation(SICKLE_Z)
    g.position.set((palm.x / size.width - 0.5) * viewport.width * comp, (0.5 - palm.y / size.height) * viewport.height * comp, SICKLE_Z)
    // The handle runs along the hand, from the wrist through the palm.
    g.rotation.z = Math.atan2(-(palm.y - wrist.y), palm.x - wrist.x) - Math.PI / 2
    // The blade curves toward +x; mirror it for the left-hand sickle so each blade curls toward the outside of the screen.
    const scale = unit * SICKLE_SIZE
    g.scale.set(handKey === 'left' ? -scale : scale, scale, scale)
  })

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 10]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.8} />
      </mesh>
      {/* Curved blade: an arc of a torus at the top of the handle */}
      <mesh position={[0.32, 0.72, 0]} rotation={[0, 0, Math.PI * 0.5]}>
        <torusGeometry args={[0.38, 0.045, 8, 28, Math.PI * 1.15]} />
        <meshStandardMaterial color="#cfd6dc" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

export default function BirdScene() {
  return (
    <>
      <Bird />
      <Sickle handKey="left" />
      <Sickle handKey="right" />
    </>
  )
}
