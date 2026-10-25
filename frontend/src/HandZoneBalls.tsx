import { useMemo, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { ballRadiusPx, balls, getBallsVersion, stepBalls, subscribeBalls } from './balls'
import BirdScene from './BirdScene'
import Cannons from './CannonScene'
import { getIronBase, ironTextureFor } from './ironTextures'
import Ships from './ShipScene'

function Cannonballs() {
  const { viewport, size } = useThree()
  const { bump } = getIronBase()
  // Re-render only when balls are merged (not every frame).
  useSyncExternalStore(subscribeBalls, getBallsVersion)
  // Same radius the grab logic uses (screen pixels), converted to world units.
  const radius = (ballRadiusPx(size.width, size.height) / size.height) * viewport.height
  // Lookups from ball id to its mesh and material, so merging can add and remove balls.
  const meshes = useMemo(() => new Map<number, THREE.Mesh>(), [])
  const materials = useMemo(() => new Map<number, THREE.MeshStandardMaterial>(), [])

  // Balls live in normalized screen space (balls.ts); mirror that into world space every frame.
  useFrame((_, delta) => {
    stepBalls(delta)
    for (const ball of balls) {
      const mesh = meshes.get(ball.id)
      const material = materials.get(ball.id)
      if (!mesh || !material) continue
      mesh.position.set((ball.x - 0.5) * viewport.width, (0.5 - ball.y) * viewport.height, 0)
      const held = ball.heldBy !== null
      mesh.scale.setScalar(held ? 1.08 : 1)
      material.emissiveIntensity = held ? 0.45 : 0
    }
  })

  const track = <T,>(store: Map<number, T>, id: number) => (item: T | null) => {
    if (item) store.set(id, item)
    else store.delete(id)
  }

  return (
    <>
      {balls.map((ball) => (
        <mesh key={ball.id} ref={track(meshes, ball.id)}>
          <sphereGeometry args={[radius, 48, 48]} />
          <meshStandardMaterial
            ref={track(materials, ball.id)}
            map={ironTextureFor(ball.value)}
            bumpMap={bump}
            bumpScale={2}
            metalness={0.7}
            roughness={0.45}
            emissive="#ff9a2a"
            emissiveIntensity={0}
          />
        </mesh>
      ))}
    </>
  )
}

export default function HandZoneBalls() {
  return (
    <Canvas
      // Narrow field of view from far away: same framing as before, but balls at the screen edges
      // are not stretched into ovals.
      camera={{ position: [0, 0, 35.5], fov: 15 }}
      gl={{ alpha: true }}
      // Ships are clipped at the waterline (ShipScene), which needs local clipping planes.
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
      }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      {/* Moody, dim lighting; the Lightformer environment is generated locally (no downloads). */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 8]} intensity={1.2} color="#cfd8e3" />
      <directionalLight position={[-4, 2, -4]} intensity={1.4} color="#6f8fa8" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3.5} color="#b4c8d6" position={[-4, 3, 4]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#ffd9a8" position={[4, -1, 3]} scale={[4, 2, 1]} />
        <Lightformer form="ring" intensity={2.5} color="#8fb0c8" position={[0, 4, -4]} scale={4} />
      </Environment>
      <Cannonballs />
      <Ships />
      <Cannons />
      <BirdScene />
    </Canvas>
  )
}
