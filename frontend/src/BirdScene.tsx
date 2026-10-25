import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { cannonLayout, LANE_END_Y } from './cannons'
import { displayToScreen, handAnchors } from './handTracking'
import { isGameRunning } from './game'
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

// The bird model is built in Blender (public/models/bird.glb). Its `wing_left` / `wing_right` nodes
// pivot at the shoulders and its `feet` node at the top of the legs, so the flap and the talons
// unfolding are still driven from here.
const BIRD_MODEL = '/models/bird.glb'
useGLTF.preload(BIRD_MODEL)

// The scythe that replaces the glove on an open hand is also a Blender model (public/models/scythe.glb),
// built to the footprint of the old sickle so the blade hit point in bird.ts is unchanged.
const SCYTHE_MODEL = '/models/scythe.glb'
useGLTF.preload(SCYTHE_MODEL)

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

function Bird() {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const feathers = useRef<THREE.Points>(null)
  const { scene } = useGLTF(BIRD_MODEL)

  const { birdModel, materials, leftWing, rightWing, feet, featherGeometry, featherVel } = useMemo(() => {
    const birdModel = scene.clone(true)
    // Own materials so the bird can fade out when it is cured.
    const materials: THREE.MeshStandardMaterial[] = []
    birdModel.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const material = (node.material as THREE.MeshStandardMaterial).clone()
      material.transparent = true
      node.material = material
      materials.push(material)
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FEATHERS * 3), 3))
    return {
      birdModel,
      materials,
      leftWing: birdModel.getObjectByName('wing_left')!,
      rightWing: birdModel.getObjectByName('wing_right')!,
      feet: birdModel.getObjectByName('feet')!,
      featherGeometry: geometry,
      featherVel: Array.from({ length: FEATHERS }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.8 + Math.random() * 2.2
        return [Math.cos(angle) * speed, Math.sin(angle) * speed] as const
      }),
    }
  }, [scene])

  useFrame(({ clock }, delta) => {
    if (isGameRunning()) stepBird(delta, size.width, size.height)
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
    leftWing.rotation.z = flap
    rightWing.rotation.z = -flap

    // Feet unfold from the belly during the last moments of the flight and stay out once landed.
    const out = bird.state === 'flying' ? Math.min(Math.max((bird.age - (BIRD_FLIGHT_TIME - FEET_OUT_TIME)) / FEET_OUT_TIME, 0), 1) : 1
    feet.visible = out > 0
    feet.scale.set(1, Math.max(out, 0.001), 1)

    for (const material of materials) material.opacity = 1 - leave * leave
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

  return (
    <group ref={group} visible={false}>
      <primitive object={birdModel} />
      <points ref={feathers} geometry={featherGeometry} visible={false} frustumCulled={false}>
        <pointsMaterial color="#d8d2c0" transparent depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}

// A large scythe (snath plus curved blade) that replaces the glove on the open hand.
function Sickle({ handKey }: { handKey: 'left' | 'right' }) {
  const { viewport, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF(SCYTHE_MODEL)
  const scythe = useMemo(() => {
    const clone = scene.clone(true)
    // There are no reflections in this scene for polished steel to pick up, so give the blade a
    // brighter, flatter finish instead of letting it read as black metal.
    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return
      if (node.material.name === 'scythe_steel') {
        node.material = node.material.clone()
        node.material.metalness = 0.2
        node.material.roughness = 0.35
        node.material.emissive.set('#3a444c')
      }
    })
    return clone
  }, [scene])

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = isGameRunning() && getSickleHands().includes(handKey)
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
      <primitive object={scythe} />
    </group>
  )
}

export default function BirdScene() {
  return (
    <>
      <Suspense fallback={null}>
        <Bird />
      </Suspense>
      <Suspense fallback={null}>
        <Sickle handKey="left" />
        <Sickle handKey="right" />
      </Suspense>
    </>
  )
}
