import { Suspense, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getSickleHands } from './bird'
import { displayToScreen, handAnchors } from './handTracking'

// Gloves are a Blender model (public/models/glove.glb): a tapered finger tube, a knuckle joint, a
// rounded palm and a ribbed cuff, all unit-sized and painted with a little dirt in vertex colours.
// Every frame each tracked hand is rebuilt from its 21 landmarks: a tube per finger bone, a joint at
// every landmark, a palm over the knuckles and a cuff at the wrist. Instanced meshes keep it cheap.

const GLOVE_MODEL = '/models/glove.glb'
useGLTF.preload(GLOVE_MODEL)

// Just behind the balls (z 0), so a ball is never hidden by the hand over it or holding it, but in
// front of the ships (z -3).
const CAMERA_Z = 35.5
const GLOVE_Z = -0.3
const COMPENSATION = (CAMERA_Z - GLOVE_Z) / CAMERA_Z

// Landmark chains for the thumb and four fingers (knuckle -> tip) and the finger thickness in hand
// sizes (wrist to middle-finger knuckle), as the old flat glove used.
const CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]
const WIDTHS = [0.3, 0.27, 0.28, 0.26, 0.23]
// Fingers thin out toward the tip.
const BONE_TAPER = [1, 0.95, 0.88]

const MAX_TUBES = 2 * 15
const MAX_JOINTS = 2 * 20
const MAX_HANDS = 2

const Y_AXIS = new THREE.Vector3(0, 1, 0)

function geometryOf(scene: THREE.Object3D, name: string) {
  let found: THREE.BufferGeometry | null = null
  scene.getObjectByName(name)?.traverse((node) => {
    if (node instanceof THREE.Mesh) found = node.geometry
  })
  if (!found) throw new Error(`glove.glb is missing ${name}`)
  return found as THREE.BufferGeometry
}

function Gloves() {
  const { scene } = useGLTF(GLOVE_MODEL)
  const { viewport, size } = useThree()

  const { group, tubes, joints, palms, cuffs } = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
    const make = (name: string, max: number) => {
      const mesh = new THREE.InstancedMesh(geometryOf(scene, name), material, max)
      mesh.frustumCulled = false
      mesh.count = 0
      // A touch of per-piece variation so the leather does not look stamped from one mould.
      for (let i = 0; i < max; i++) mesh.setColorAt(i, new THREE.Color().setScalar(0.88 + 0.12 * ((i * 37) % 11) / 10))
      return mesh
    }
    const tubes = make('glove_tube', MAX_TUBES)
    const joints = make('glove_joint', MAX_JOINTS)
    const palms = make('glove_palm', MAX_HANDS)
    const cuffs = make('glove_cuff', MAX_HANDS)
    const group = new THREE.Group()
    group.add(tubes, joints, palms, cuffs)
    return { group, tubes, joints, palms, cuffs }
  }, [scene])

  // Scratch objects reused every frame.
  const scratch = useMemo(
    () => ({
      pts: Array.from({ length: 21 }, () => new THREE.Vector3()),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      up: new THREE.Vector3(),
      right: new THREE.Vector3(),
      back: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      basis: new THREE.Matrix4(),
    }),
    [],
  )

  useFrame(() => {
    const { pts, a, b, mid, dir, up, right, back, pos, scale, q, m, basis } = scratch
    const sickles = getSickleHands()
    let nTubes = 0
    let nJoints = 0
    let nHands = 0

    for (const key of ['left', 'right'] as const) {
      const hand = handAnchors[key]
      // A thumbs-up hand is replaced by the scythe, so it gets no glove.
      if (!hand.present || hand.landmarks.length < 21 || hand.gesture === 'Thumb_Up' || sickles.includes(key)) continue

      for (let i = 0; i < 21; i++) {
        const p = displayToScreen(hand.landmarks[i], size.width, size.height)
        pts[i].set((p.x / size.width - 0.5) * viewport.width * COMPENSATION, (0.5 - p.y / size.height) * viewport.height * COMPENSATION, GLOVE_Z)
      }
      const s = Math.max(pts[0].distanceTo(pts[9]), viewport.height * 0.03) // hand size: wrist to middle knuckle

      // Fingers: a tube per bone with a joint at each knuckle and at the tip.
      CHAINS.forEach((chain, c) => {
        const radius = (s * WIDTHS[c]) / 2
        chain.forEach((idx, k) => {
          const r = radius * (BONE_TAPER[Math.min(k, 2)] ?? 0.88)
          if (nJoints < MAX_JOINTS) {
            m.compose(pos.copy(pts[idx]), q.identity(), scale.setScalar(r * 1.02))
            joints.setMatrixAt(nJoints++, m)
          }
          if (k === chain.length - 1 || nTubes >= MAX_TUBES) return
          a.copy(pts[idx])
          b.copy(pts[chain[k + 1]])
          dir.subVectors(b, a)
          const length = dir.length()
          if (length < 1e-6) return
          q.setFromUnitVectors(Y_AXIS, dir.divideScalar(length))
          m.compose(mid.addVectors(a, b).multiplyScalar(0.5), q, scale.set(r, length, r))
          tubes.setMatrixAt(nTubes++, m)
        })
      })

      // Palm: a rounded pad over the knuckles; x across the hand, y wrist -> knuckles, z toward the viewer.
      up.subVectors(pts[9], pts[0])
      const palmLength = up.length()
      up.divideScalar(palmLength || 1)
      right.set(up.y, -up.x, 0)
      back.crossVectors(right, up)
      basis.makeBasis(right, up, back)
      q.setFromRotationMatrix(basis)
      const palmWidth = pts[5].distanceTo(pts[17]) + 0.2 * s
      pos.copy(pts[0]).addScaledVector(up, palmLength * 0.48)
      m.compose(pos, q, scale.set(palmWidth, palmLength, 0.34 * s))
      palms.setMatrixAt(nHands, m)

      // Cuff at the wrist, flaring away from the fingers.
      dir.copy(up).negate()
      q.setFromUnitVectors(Y_AXIS, dir)
      pos.copy(pts[0]).addScaledVector(dir, 0.18 * s)
      m.compose(pos, q, scale.set(palmWidth * 0.4, 0.5 * s, palmWidth * 0.4))
      cuffs.setMatrixAt(nHands, m)
      nHands++
    }

    tubes.count = nTubes
    joints.count = nJoints
    palms.count = nHands
    cuffs.count = nHands
    for (const mesh of [tubes, joints, palms, cuffs]) mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={group} />
}

export default function GloveScene() {
  return (
    <Suspense fallback={null}>
      <Gloves />
    </Suspense>
  )
}
