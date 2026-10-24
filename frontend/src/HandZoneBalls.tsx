import { useMemo, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { ballRadiusPx, balls, getBallsVersion, stepBalls, subscribeBalls } from './balls'

const TEX_W = 512
const TEX_H = 256

// Procedural iron: mottled dark metal with rust blotches and scratches, plus a pitted bump map.
function makeIronBase() {
  const make = () => {
    const canvas = document.createElement('canvas')
    canvas.width = TEX_W
    canvas.height = TEX_H
    return { canvas, g: canvas.getContext('2d')! }
  }

  const { canvas: colorCanvas, g } = make()
  g.fillStyle = '#4a4e53'
  g.fillRect(0, 0, TEX_W, TEX_H)
  for (let i = 0; i < 6000; i++) {
    const v = 50 + Math.floor(Math.random() * 40)
    g.fillStyle = `rgba(${v}, ${v}, ${v + 4}, 0.5)`
    g.fillRect(Math.random() * TEX_W, Math.random() * TEX_H, 2, 2)
  }
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * TEX_W
    const y = Math.random() * TEX_H
    const r = 6 + Math.random() * 26
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(140, 68, 28, 0.55)')
    grad.addColorStop(1, 'rgba(140, 68, 28, 0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.strokeStyle = 'rgba(175, 180, 185, 0.25)'
  g.lineWidth = 1
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * TEX_W
    const y = Math.random() * TEX_H
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60)
    g.stroke()
  }

  const { canvas: bumpCanvas, g: b } = make()
  b.fillStyle = '#808080'
  b.fillRect(0, 0, TEX_W, TEX_H)
  for (let i = 0; i < 2500; i++) {
    const v = 90 + Math.floor(Math.random() * 90)
    b.fillStyle = `rgb(${v}, ${v}, ${v})`
    b.beginPath()
    b.arc(Math.random() * TEX_W, Math.random() * TEX_H, 0.6 + Math.random() * 2.2, 0, Math.PI * 2)
    b.fill()
  }

  const bump = new THREE.CanvasTexture(bumpCanvas)
  return { colorCanvas, bump }
}

// Copy of the iron texture with the number stamped on the side that faces the camera
// (u = 0.25 on a three.js sphere is the +z side). Painted on, so no DOM overlay is needed.
function numberedTexture(base: HTMLCanvasElement, value: number) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const g = canvas.getContext('2d')!
  g.drawImage(base, 0, 0)
  // Shrink the font as numbers get longer so two- and three-digit sums still fit.
  const digits = String(value).length
  g.font = `bold ${digits === 1 ? 84 : digits === 2 ? 68 : 52}px Georgia, serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const x = TEX_W * 0.25
  const y = TEX_H * 0.5
  g.lineJoin = 'round'
  g.lineWidth = 9
  g.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  g.strokeText(String(value), x, y)
  g.fillStyle = '#e6dfcc'
  g.fillText(String(value), x, y)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return map
}

// One texture per distinct number, created the first time a ball shows it and reused after.
const textureCache = new Map<number, THREE.CanvasTexture>()
function textureFor(value: number, base: HTMLCanvasElement) {
  let texture = textureCache.get(value)
  if (!texture) {
    texture = numberedTexture(base, value)
    textureCache.set(value, texture)
  }
  return texture
}

function Cannonballs() {
  const { viewport, size } = useThree()
  const { colorCanvas, bump } = useMemo(() => makeIronBase(), [])
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
            map={textureFor(ball.value, colorCanvas)}
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
    </Canvas>
  )
}
