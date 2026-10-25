import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RACK_DROP, rackY } from './balls'

// The cannonball rack is a Blender model (public/models/rack.glb) that the balls rest and roll on:
// a trough with front and back boards, legs, an end stop at the right and a pirate hat on its own peg.
// The model is built with 1 unit = the width of the screen and its origin on the balls' centre line
// at the middle of the screen, so it only has to be scaled by the viewport width and tilted to the
// slope the balls follow (balls.ts rackY). It sits at z = 0, the same depth as the balls, so the
// balls are cradled between its boards.

const RACK_MODEL = '/models/rack.glb'
useGLTF.preload(RACK_MODEL)

// A soft, wide contact shadow under the rack so it sits on the sand instead of floating.
let shadowTexture: THREE.CanvasTexture | null = null
function getShadowTexture() {
  if (shadowTexture) return shadowTexture
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 32
  const g = canvas.getContext('2d')!
  g.translate(128, 16)
  g.scale(1, 0.125)
  const gradient = g.createRadialGradient(0, 0, 0, 0, 0, 128)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = gradient
  g.fillRect(-128, -128, 256, 256)
  shadowTexture = new THREE.CanvasTexture(canvas)
  return shadowTexture
}

function Rack() {
  const { scene } = useGLTF(RACK_MODEL)
  const { viewport } = useThree()
  const group = useRef<THREE.Group>(null)
  const rack = useMemo(() => scene.clone(true), [scene])
  const shadow = useMemo(() => getShadowTexture(), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.scale.setScalar(viewport.width)
    // Origin on the balls' centre line at the middle of the screen, tilted to follow the slope.
    g.position.set(0, (0.5 - rackY(0.5)) * viewport.height, 0)
    g.rotation.z = -Math.atan((RACK_DROP * viewport.height) / viewport.width)
  })

  return (
    <group ref={group}>
      <primitive object={rack} />
      {/* Contact shadow along the feet, behind the rack */}
      <mesh position={[-0.07, -0.155, -0.09]} scale={[1.24, 0.08, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function RackScene() {
  return (
    <Suspense fallback={null}>
      <Rack />
    </Suspense>
  )
}
