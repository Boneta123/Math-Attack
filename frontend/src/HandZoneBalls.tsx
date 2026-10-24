import { Canvas, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'

const BALL_VALUES = [1, 2, 3, 4, 5]
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']

function Balls() {
  const { viewport } = useThree()
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
          <meshStandardMaterial color={COLORS[i % COLORS.length]} roughness={0.35} />
          <Html center style={{ pointerEvents: 'none', userSelect: 'none' }} zIndexRange={[0, 0]}>
            <span style={{ color: '#fff', font: 'bold 40px system-ui, sans-serif' }}>{value}</span>
          </Html>
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
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 8]} intensity={2} />
      <Balls />
    </Canvas>
  )
}
