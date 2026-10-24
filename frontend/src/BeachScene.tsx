import BeachShader from './BeachShader'

// The sea, sand and shoreline are all drawn by BeachShader (the shoreline sits at the top of the
// hand zone, matching the divider in App.tsx).
export default function BeachScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <BeachShader />
    </div>
  )
}
