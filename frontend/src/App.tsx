import Camera from './Camera'
import HandZoneBalls from './HandZoneBalls'

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Camera />
      <HandZoneBalls />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '33.333%',
          boxSizing: 'border-box',
          borderTop: '3px solid #fff',
          background: 'rgba(0, 0, 0, 0.25)',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            color: '#fff',
            font: '14px system-ui, sans-serif',
            opacity: 0.8,
          }}
        >
          Hand zone
        </span>
      </div>
    </div>
  )
}
