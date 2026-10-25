import { useSyncExternalStore } from 'react'
import BeachScene from './BeachScene'
import Camera from './Camera'
import HandZoneBalls from './HandZoneBalls'
import GameOver from './GameOver'
import { getScreen, subscribeScreen } from './game'
import Home from './Home'
import Calibration from './Calibration'
import ModeSelect from './ModeSelect'
import Hud from './Hud'

export default function App() {
  const screen = useSyncExternalStore(subscribeScreen, getScreen)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Camera />
      <BeachScene />
      <HandZoneBalls />
      {screen === 'home' && <Home />}
      {screen === 'modeSelect' && <ModeSelect />}
      {screen === 'calibrating' && <Calibration />}
      {screen === 'playing' && <Hud />}
      <GameOver />
    </div>
  )
}
