import BeachWorld from './BeachWorld'

// The sea, sand, shoreline and beach props come from Blender models (see BeachWorld.tsx). The
// shoreline sits at the top of the hand zone, matching the divider in App.tsx.
export default function BeachScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <BeachWorld />
    </div>
  )
}
