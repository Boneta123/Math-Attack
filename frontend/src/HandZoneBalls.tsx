import { useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

const BALL_VALUES = [1, 2, 3, 4, 5]

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
  g.font = 'bold 84px Georgia, serif'
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

function Cannonballs() {
  const { viewport } = useThree()
  const { maps, bump } = useMemo(() => {
    const { colorCanvas, bump } = makeIronBase()
    return { maps: BALL_VALUES.map((v) => numberedTexture(colorCanvas, v)), bump }
  }, [])
  // Hand zone is the bottom third of the screen; its vertical center in world units.
  const y = -viewport.height / 3
  const zoneHeight = viewport.height / 3
  const radius = Math.min(zoneHeight * 0.3, viewport.width / (BALL_VALUES.length * 2.6))
  const spacing = viewport.width / (BALL_VALUES.length + 1)

  return (
    <>
      {BALL_VALUES.map((value, i) => (
        <mesh key={value} position={[(i + 1) * spacing - viewport.width / 2, y, 0]}>
          <sphereGeometry args={[radius, 48, 48]} />
          <meshStandardMaterial map={maps[i]} bumpMap={bump} bumpScale={2} metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
    </>
  )
}

export default function HandZoneBalls() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
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
