# Changes

## frontend-initialization

- Created branch `frontend-initialization` from `main` (no commits made).
- Scaffolded `frontend/` with `npm create vite@latest frontend -- --template react-ts` (create-vite v9.3.1, Vite v8.3.5).
- Ran `npm install` in `frontend/` (no extra dependencies added beyond the template).
- Removed template demo files: `frontend/src/App.css`, `frontend/src/assets/`, `frontend/public/icons.svg`.
- Replaced `frontend/src/index.css` with a minimal full-viewport reset (no margin, no scroll, black background).
- Added `frontend/src/Camera.tsx`: requests webcam via `getUserMedia`, renders a mirrored full-viewport `<video>` (autoPlay, playsInline, muted), stops tracks on unmount, shows a clear message on denied/no camera.
- Replaced `frontend/src/App.tsx` to render only `<Camera />`.
- Changed page title in `frontend/index.html` to "Number Rush".
- Ran `npm run build` in `frontend/`: passes with no TypeScript errors.
- Started dev server (`npm run dev` in `frontend/`): http://localhost:5173/
- Added "Running the Frontend" commands (install, dev, build, preview, lint) to `README.md`.

## mediapipe-initialization

- Created branch `mediapipe-initialization` from `main` (no commits made).
- Ran `npm install @mediapipe/tasks-vision` in `frontend/` (v1.1.1); updated `frontend/package.json` and `frontend/package-lock.json`.
- Downloaded the Hand Landmarker model to `frontend/public/models/hand_landmarker.task` (float16, from storage.googleapis.com/mediapipe-models).
- Added `frontend/src/handTracking.ts`: initializes `HandLandmarker` (VIDEO mode, 2 hands, GPU with CPU fallback, WASM from jsdelivr pinned to 1.1.1). Exports the mutable `handAnchors` store (`left` / `right` with `present`, all 21 `landmarks`, `thumbTip`, `indexTip`, `wrist`; x/y normalized 0..1 and already mirrored), plus `detect`, `initHandTracking`, `closeHandTracking`.
- Modified `frontend/src/Camera.tsx`: overlay `<canvas>` draws 21 points and connections per hand (thumb tip and index tip drawn larger in a different color), mapped through the `object-fit: cover` crop with devicePixelRatio handling; "Show your hand to the camera" hint; message if the hand model fails to load.
- Ran `npm run build` and `npm run lint` in `frontend/`: both pass.
- Dev server: http://localhost:5173/ (already running).
- Fix: `Cannot read properties of undefined (reading 'activeTexture')` thrown from `detect`. React StrictMode ran the init effect twice, creating two landmarkers sharing one GL context. `initHandTracking` in `frontend/src/handTracking.ts` is now a single shared promise, and `closeHandTracking` was replaced by `stopHandTracking` (clears anchors only; the landmarker lives for the page lifetime). `Camera.tsx` updated to match. Build and lint pass.
- Fix: `activeTexture` errors and repeated "Resolved a deadlock ... norm_rect" warnings persisted after the single-instance change. `handTracking.ts` now uses the CPU delegate only (no GPU) and wraps `detectForVideo` in try/catch so a failure logs once per frame instead of throwing from the animation loop. Build and lint pass.

## hand-states

- Modified `frontend/src/handTracking.ts`: added `HandState` (`'OPEN' | 'GRAB'`), and `state` plus `palm` on `HandAnchors`. `palm` is the mean of landmarks 0, 5, 9, 13, 17 in mirrored display space. MediaPipe's HandLandmarker has no built-in gestures, so the fist is computed from landmarks.
- Fist rule: a finger (index, middle, ring, pinky; tips 8/12/16/20, PIPs 6/10/14/18) is curled when its tip is closer to the wrist than its PIP (x/y only). Fist = at least 3 of 4 curled (`CURLED_FINGERS_FOR_FIST`). Thumb ignored.
- Hysteresis: state flips only after 3 consecutive disagreeing frames (`FRAMES_TO_SWITCH`), tracked per hand. `detect` now resets only hands that disappeared, so state persists across frames.
- Modified `frontend/src/Camera.tsx`: each visible hand shows an "OPEN" / "GRAB" label near the palm, and landmark dots turn green while GRAB. Added one demo ball ("5") on the overlay canvas: OPEN -> GRAB with the palm inside the ball picks it up, it follows the palm while GRAB, and it drops on OPEN or when the hand disappears. Ball state is module-level, not React state.
- `npm run build` and `npm run lint` pass.
- Verified in headless Chrome with a still hand photo as the camera: labels render as OPEN on both hands, the ball renders, no console errors. NOT verified: GRAB detection and dragging (needs a real fist in front of the camera), and the earlier `activeTexture` WebGL error on the user's own browser.

## gesture-recognition

- Modified `frontend/src/handTracking.ts`: added `Gesture` type (`None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`; same names as MediaPipe GestureRecognizer) and `gesture` on `HandAnchors`. Classified from landmarks by `classifyGesture` (no new model or dependency): a finger is extended when its tip is farther from the wrist than its PIP; the thumb when its tip is farther from the pinky MCP than its IP. Thumb Up/Down need the thumb tip 0.6 hand-sizes above/below the wrist; Pointing Up needs the index tip 0.8 hand-sizes above the wrist (named constants). A new gesture must hold for 3 consecutive frames (per hand).
- `state` (`OPEN` / `GRAB`) is now derived from the gesture: `GRAB` only for `Closed_Fist`. This replaces the earlier "3 of 4 fingers curled" rule, which wrongly read Pointing Up as GRAB. Removed `isFist`, `CURLED_FINGERS_FOR_FIST` and the separate state counters.
- Modified `frontend/src/Camera.tsx`: removed the demo ball and its pick-up/drag logic. Hand label now shows "<Gesture> (<STATE>)" near the palm; dots stay green while GRAB.
- `npm run build` and `npm run lint` pass.
- Verified in headless Chrome using still photos as the camera: Victory, Pointing Up (state OPEN) and Open Palm (two hands) classify correctly. NOT verified: Closed_Fist/GRAB, Thumb_Up, Thumb_Down, ILoveYou (no sample images), and live webcam use. The `activeTexture` WebGL error on the user's browser was not addressed.
