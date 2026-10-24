import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

// Keep in sync with the installed @mediapipe/tasks-vision version.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
const MODEL_URL = '/models/hand_landmarker.task'

export type Point = { x: number; y: number; z: number }

export type HandState = 'OPEN' | 'GRAB'

// Same names as MediaPipe's GestureRecognizer categories, so a later swap is drop-in.
export type Gesture =
  | 'None'
  | 'Closed_Fist'
  | 'Open_Palm'
  | 'Pointing_Up'
  | 'Thumb_Up'
  | 'Thumb_Down'
  | 'Victory'
  | 'ILoveYou'

export type HandAnchors = {
  present: boolean
  state: HandState
  gesture: Gesture
  landmarks: Point[]
  thumbTip: Point
  indexTip: Point
  wrist: Point
  palm: Point
}

// x and y are normalized 0..1 in DISPLAY space (already mirrored: x = 1 - rawX),
// so they match what the player sees. z is MediaPipe's relative depth.
export type HandAnchorStore = {
  left: HandAnchors
  right: HandAnchors
  timestamp: number
}

const THUMB_TIP = 4
const INDEX_TIP = 8
const WRIST = 0

// Finger landmarks used by classifyGesture: tips and PIP joints of index, middle, ring, pinky.
const FINGER_TIPS = [8, 12, 16, 20]
const FINGER_PIPS = [6, 10, 14, 18]
const PALM_POINTS = [0, 5, 9, 13, 17]
// Gesture rules (see classifyGesture). Thumb IP = 3; MIDDLE_MCP sizes the hand; PINKY_MCP anchors the thumb check.
const THUMB_IP = 3
const MIDDLE_MCP = 9
const PINKY_MCP = 17
// A thumb must point this many hand-sizes above/below the wrist to count as up/down.
const THUMB_VERTICAL_MARGIN = 0.6
// An index finger must reach this many hand-sizes above the wrist to count as pointing up.
const POINT_UP_MARGIN = 0.8
// Consecutive processed frames required before the state flips (prevents flicker).
const FRAMES_TO_SWITCH = 3

const emptyPoint = (): Point => ({ x: 0, y: 0, z: 0 })

const emptyHand = (): HandAnchors => ({
  present: false,
  state: 'OPEN',
  gesture: 'None',
  landmarks: [],
  thumbTip: emptyPoint(),
  indexTip: emptyPoint(),
  wrist: emptyPoint(),
  palm: emptyPoint(),
})

// Plain mutable object (not React state) so it can be read every frame without re-renders.
export const handAnchors: HandAnchorStore = {
  left: emptyHand(),
  right: emptyHand(),
  timestamp: 0,
}

type HandKey = 'left' | 'right'

// Frames in a row that disagree with the current state, per hand.
const gestureDisagreeFrames: Record<HandKey, number> = { left: 0, right: 0 }
const gestureCandidate: Record<HandKey, Gesture> = { left: 'None', right: 'None' }

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// Rule-based gesture classifier (HandLandmarker has no built-in gestures).
// A finger is extended when its tip is farther from the wrist than its PIP joint.
// The thumb is extended when its tip is farther from the pinky MCP than its IP joint.
function classifyGesture(lm: Point[]): Gesture {
  const wrist = lm[WRIST]
  const handSize = dist(wrist, lm[MIDDLE_MCP])
  const [index, middle, ring, pinky] = FINGER_TIPS.map(
    (tip, i) => dist(lm[tip], wrist) > dist(lm[FINGER_PIPS[i]], wrist),
  )
  const thumb = dist(lm[THUMB_TIP], lm[PINKY_MCP]) > dist(lm[THUMB_IP], lm[PINKY_MCP])
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length

  if (extendedCount === 4) return 'Open_Palm'
  if (extendedCount === 0) {
    const rise = (wrist.y - lm[THUMB_TIP].y) / handSize // image y grows downward
    if (thumb && rise > THUMB_VERTICAL_MARGIN) return 'Thumb_Up'
    if (thumb && -rise > THUMB_VERTICAL_MARGIN) return 'Thumb_Down'
    return 'Closed_Fist'
  }
  if (index && middle && !ring && !pinky) return 'Victory'
  if (thumb && index && pinky && !middle && !ring) return 'ILoveYou'
  if (index && !middle && !ring && !pinky && (wrist.y - lm[FINGER_TIPS[0]].y) / handSize > POINT_UP_MARGIN) {
    return 'Pointing_Up'
  }
  return 'None'
}

function fill(key: HandKey, landmarks: { x: number; y: number; z: number }[]) {
  const target = handAnchors[key]
  target.present = true
  target.landmarks = landmarks.map((l) => ({ x: 1 - l.x, y: l.y, z: l.z }))
  target.thumbTip = target.landmarks[THUMB_TIP]
  target.indexTip = target.landmarks[INDEX_TIP]
  target.wrist = target.landmarks[WRIST]
  target.palm = {
    x: PALM_POINTS.reduce((sum, i) => sum + target.landmarks[i].x, 0) / PALM_POINTS.length,
    y: PALM_POINTS.reduce((sum, i) => sum + target.landmarks[i].y, 0) / PALM_POINTS.length,
    z: PALM_POINTS.reduce((sum, i) => sum + target.landmarks[i].z, 0) / PALM_POINTS.length,
  }

  // Gesture needs the same candidate for FRAMES_TO_SWITCH frames before it replaces the current one.
  const candidate = classifyGesture(target.landmarks)
  if (candidate === target.gesture) {
    gestureDisagreeFrames[key] = 0
  } else {
    gestureDisagreeFrames[key] = candidate === gestureCandidate[key] ? gestureDisagreeFrames[key] + 1 : 1
    gestureCandidate[key] = candidate
    if (gestureDisagreeFrames[key] >= FRAMES_TO_SWITCH) {
      target.gesture = candidate
      gestureDisagreeFrames[key] = 0
    }
  }

  // GRAB is exactly the closed-fist gesture (inherits its frame-count hysteresis).
  target.state = target.gesture === 'Closed_Fist' ? 'GRAB' : 'OPEN'
}

function reset(key: HandKey) {
  const target = handAnchors[key]
  target.present = false
  target.state = 'OPEN'
  target.gesture = 'None'
  target.landmarks = []
  gestureDisagreeFrames[key] = 0
  gestureCandidate[key] = 'None'
}

let landmarker: HandLandmarker | null = null
let initPromise: Promise<void> | null = null

// Single shared instance: React StrictMode runs effects twice in dev, and two landmarkers
// created in parallel (or one closed while another runs) break MediaPipe's shared GL context.
export function initHandTracking(): Promise<void> {
  initPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL)
    // CPU delegate: the GPU delegate threw "activeTexture" GL errors on the dev machine.
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  })().catch((err) => {
    initPromise = null
    throw err
  })
  return initPromise
}

// The landmarker intentionally stays alive for the page lifetime; only clear the anchors.
export function stopHandTracking() {
  reset('left')
  reset('right')
}

export function detect(video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult | null {
  if (!landmarker) return null
  let result: HandLandmarkerResult
  try {
    result = landmarker.detectForVideo(video, timestampMs)
  } catch (err) {
    console.error('Hand detection failed', err)
    return null
  }

  const seen = new Set<HandKey>()
  result.landmarks.forEach((landmarks, i) => {
    // MediaPipe assumes a mirrored (selfie) input. The raw, unmirrored frame swaps
    // the labels, so "Left" here is the player's right hand.
    const label = result.handedness[i]?.[0]?.categoryName
    const key: HandKey = label === 'Left' ? 'right' : 'left'
    seen.add(key)
    fill(key, landmarks)
  })
  // Only hands that vanished are reset, so state and hysteresis persist across frames.
  for (const key of ['left', 'right'] as const) {
    if (!seen.has(key)) reset(key)
  }
  handAnchors.timestamp = timestampMs
  return result
}

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS
export { THUMB_TIP, INDEX_TIP }
