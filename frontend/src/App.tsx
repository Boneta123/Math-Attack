import BeachScene from './BeachScene'
import Camera from './Camera'
import HandZoneBalls from './HandZoneBalls'
import GameOver from './GameOver'
import Hud from './Hud'

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Camera />
      <BeachScene />
      <HandZoneBalls />
      <Hud />
      <GameOver />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '45%',
          boxSizing: 'border-box',
          // Dark tideline; the sand tint itself comes from BeachScene.
          borderTop: '3px solid rgba(214, 222, 224, 0.55)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        <span
          style={{
            position: 'absolute',
            // Sits just above the tideline: the ball grid now fills the whole zone.
            top: -26,
            left: 12,
            color: '#e6dcc4',
            font: '14px system-ui, sans-serif',
            opacity: 0.8,
            textShadow: '0 1px 3px #000',
          }}
        >
          Hand zone
        </span>
      </div>
    </div>
  )
}
