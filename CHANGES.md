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

## ui-updates

- Created branch `ui-updates` from the current branch (no commits made).
- Theme: gloomy beach under invasion. Water (top two thirds), sand (bottom third, the hand zone), iron cannonballs, brown leather gloves. All environment layers are translucent so the webcam feed stays visible.
- MCP components used (Magic UI MCP, `getRegistryItem`): `ripple` (water rings), `noise-texture` (sand grain), `particles` (drifting mist). None declares npm dependencies, but all assume Tailwind and shadcn's `cn()`, which this project does not have, so their logic was ported to plain React and CSS in `frontend/src/effects/` (`Ripple.tsx`, `NoiseTexture.tsx`, `Particles.tsx`). The port of `particles` drops the mouse tracking. No packages installed; nothing added to `package.json`.
- Other MCP servers (Blender, Figma, Roblox, Claude Docs, Atlassian, Intercom, Linear, Notion, Slack) were not relevant and not used. Claude in Chrome was not connected, so verification used headless Chrome.
- Added `frontend/src/BeachScene.tsx` and `frontend/src/beach.css`: stormy water with scrolling wave lines and a pale horizon haze, distant invader ship silhouettes, a sinking hull at the left edge, damp sand tint with grain, a wavy foam shoreline, hull-rib and mast wreckage (bottom left), anchor, barrel and planks (bottom right), fog banks, drifting mist, and an overcast vignette.
- Modified `frontend/src/App.tsx`: mounts `BeachScene`, restyled the hand-zone divider as a pale tideline, restyled its label. Layering is by z-index: video, BeachScene (1), cannonball canvas (5), tideline (6), hand overlay canvas (10), hints (12).
- Modified `frontend/src/HandZoneBalls.tsx`: balls are now iron cannonballs (procedural rust, scratches and pitting textures, metallic material, moody lighting with a locally generated Lightformer environment, no downloads). Ball size, position and spacing are unchanged. Numbers are now painted into each ball's texture instead of drei `Html` overlays. This also fixes an existing bug on `main`: ball "1" never rendered its number, with the console error "Attempted to synchronously unmount a root while React was already rendering" (confirmed on a clean copy of `main`).
- Added `frontend/src/glove.ts` and modified the drawing code in `frontend/src/Camera.tsx`: a brown leather glove (palm, five finger chains, cuff with band, sheen, stitching) is drawn over each tracked hand, then the connections, then all 21 landmark points, then the gesture label. The overlay canvas is now above the cannonballs. The webcam `<video>` has a CSS filter (`saturate(0.6) brightness(0.82) contrast(1.05)`) for the gloomy look; this only changes display, not the frames MediaPipe reads.
- `handTracking.ts`, gameplay and hand-tracking logic were not changed.
- `npm run build` and `npm run lint` pass. The build still warns that the JS bundle exceeds 500 kB (three.js), which predates this branch.
- Verified in headless Chrome using still photos (one and two hands) as the camera: water, sand, wreckage, ships, cannonballs with numbers 1 to 5, gloves with all 21 points, and no console errors. NOT verified: live webcam, real-hand interaction, frame rate on real hardware, and the earlier `activeTexture` WebGL error on the user's browser.
- Camera feed hidden: `frontend/src/Camera.tsx` now sets the webcam `<video>` to `opacity: 0` via a `SHOW_CAMERA_FEED = false` constant. The stream keeps running because MediaPipe reads its frames, but only the beach scene and the gloved hands are visible. Hand-to-screen mapping is unchanged. Set the constant to `true` to bring the feed back for alignment debugging. The beach layers were left unchanged, so the scene is darker without the feed behind it. Build and lint pass; verified in headless Chrome with a still hand photo, no console errors.

## game-physics

- Created branch `game-physics` from `main` (after merging and pushing `ui-updates`; no commits made on this branch).
- Added `frontend/src/balls.ts`: shared ball state (`balls`, normalized screen coordinates plus `heldBy`) and `updateBalls`. A closed fist (the `GRAB` state) that closes within 1.25 ball radii of a ball picks up the nearest free ball. The ball follows the palm while the fist stays closed, and drops in place when the hand opens or disappears. A fist already closed that slides onto a ball does not pick it up, a held ball cannot be taken by the other hand, and each hand holds at most one ball. Held balls are clamped to the screen.
- Balls are now 15% smaller (`BALL_SCALE = 0.85`), same layout and spacing.
- Modified `frontend/src/HandZoneBalls.tsx`: balls read their position from `balls.ts` every frame (`useFrame`); a held ball scales up 8% and glows warm orange.
- Modified `frontend/src/Camera.tsx`: calls `updateBalls` each frame with the palm position and GRAB state. Gloves are drawn onto an offscreen layer, then composited opaque everywhere except over the balls, where they are 35% opaque so the balls stay visible. Points, connections and labels are unchanged.
- Verified: grab logic with a 14-case Node test (grab, follow, drop, no sweep-up, no stealing, clamping, two hands, ball size); `npm run build` and `npm run lint` pass; headless Chrome with a still hand photo shows smaller balls, see-through gloves over balls 4 and 5, and no console errors. NOT verified: grabbing with a real fist in front of the live webcam.

## ball-merging

- Worked directly on `main` (no branch created); the local `game-physics` branch was deleted first (already merged, never pushed). No commits made.
- Modified `frontend/src/balls.ts`: every ball has a unique `id`; `balls` is mutated in place. New merge rule at the end of `updateBalls`: when the left hand holds a ball, the right hand holds a ball, and their centers are at most 2 ball radii apart (`MERGE_DISTANCE`, balls touching), both balls are removed and one new ball with the sum of their values appears at the right palm, held by the right hand. It follows the right palm while the fist stays closed and drops in place when the right hand opens or disappears. The left fist is still closed, so it cannot re-grab until it opens and closes again. Merged balls can merge again. Added `subscribeBalls` / `getBallsVersion` so the renderer updates only on merge.
- Modified `frontend/src/HandZoneBalls.tsx`: renders from the live `balls` array, keyed by id (`useSyncExternalStore`, so React re-renders only on a merge, never per frame); number textures are created on demand per distinct value and cached; font shrinks for two and three digits. Same radius, material and held glow as the other balls.
- `Camera.tsx` unchanged: its see-through gloves already read the live `balls` array.
- Verified: throwaway Node test (22 cases: 2+3=5, chained 1+2=3 then 3+4=7, right-hand ownership, no instant left re-grab, no merge when far apart, with an open hand, or with one held ball, count drops by one per merge, unique ids, drop in place) all pass and the test file was deleted; `npm run build` and `npm run lint` pass; in headless Chrome the page's own `updateBalls` was driven through a chain of merges (1,2,3,4,5 down to one ball showing 15) and rendered correctly with readable two-digit numbers and no console errors. NOT verified: merging with real fists on the live webcam.
- Note: merges consume balls and nothing refills the rack, so a few merges leave few balls. Not part of this request.

## ball-grid

- Worked on `main`; no commits made (the earlier uncommitted ball-merging work is still in the tree and this builds on it).
- Modified `frontend/src/balls.ts`: invisible 2 x 10 grid (20 slots, `MAX_BALLS`) in the bottom-third hand zone. Resting balls always occupy a slot (`slot` on each ball, `null` while held). Ball radius is now fixed so 20 balls fit: 0.44 x the smaller grid-cell dimension (about 53px at 1280x720, a gap of about 14px between balls), replacing the old 5-ball sizing.
- Balls funnel in from the sides: every 3s (`SPAWN_INTERVAL`), while there are fewer than 20 balls, a new ball (random value 1 to 5) enters from the left or right edge, alternating, into the emptier row. It takes that row's end slot; if the end slot is taken, the run of balls next to it slides one slot inward to make room, so balls disperse along the grid on each arrival. Everything glides to its slot (`SETTLE_RATE`).
- Picking a ball up frees its slot and other balls do not move. A released (or merged-then-released) ball snaps into the nearest free slot and glides there. Held balls count toward the 20, so a free slot always exists on release. The first 5 balls start in the middle of the bottom row. Merging frees capacity, so new balls keep arriving.
- Modified `frontend/src/HandZoneBalls.tsx`: calls `stepBalls(delta)` each frame; camera changed from fov 50 at z=10 to fov 15 at z=35.5 (same framing) so balls near the screen edges are not stretched into ovals.
- Modified `frontend/src/Camera.tsx` (hint moved from the bottom to the top so it no longer sits over the balls) and `frontend/src/App.tsx` ("Hand zone" label moved just above the tideline).
- Verified: throwaway Node test (31 checks plus a 20,000-step randomized fuzz test of slot, id and held-ball invariants) passes except one check that was a test artifact (single 0.2s step); real-page run shows 5 balls at start, the first ball arriving at slot 0 from the left after 3s, and a full 20-ball grid with no overlaps; `npm run build` and `npm run lint` pass; no console errors. NOT verified: grabbing and dropping with real fists on the live webcam.

## finger-pinch-pickup

- Worked on `main`; no commits made.
- Balls are now picked up by pinching the index and middle fingertips together (not by closing a fist). Separating the fingers releases the ball, which snaps into the nearest free grid slot. After a merge the new ball goes to the right hand, as before (the right hand keeps it while its fingers stay together).
- Modified `frontend/src/handTracking.ts`: new `pinch` and `pinchPoint` on `HandAnchors` (midpoint of landmarks 8 and 12, display space). The pinch closes when the fingertips are within 0.3 hand-sizes (wrist to middle knuckle, measured with the camera aspect ratio so x and y are not stretched) and stays closed until they pass 0.45 (hysteresis), and flips only after 2 consecutive frames. Both fingers must be roughly straight (tip far from the wrist compared with its knuckle), so a curled fist with touching fingertips does not count. `isPinching` is exported for testing. The earlier gesture classifier and `state` (OPEN/GRAB) are unchanged and still computed, kept for later features, but nothing displays or uses them now.
- Modified `frontend/src/balls.ts`: `HandInput` is now `{ present, pinch, point }`; the ball is picked up on a new pinch within 1.5 ball radii of its center (was 1.25 for the fist, slightly more forgiving because the pinch point is a fingertip midpoint) and follows the pinch point instead of the palm. All other rules unchanged: pickup needs a fresh pinch (fingers already together sliding onto a ball do nothing), nearest ball wins, one ball per hand, merge when held balls touch, snap to the grid on release.
- Modified `frontend/src/Camera.tsx`: labels now only say "Ball held" (fingers together) or "Ball released"; landmark dots and the two key dots (index and middle fingertips, drawn larger) turn green while held. The landmarks and glove are otherwise unchanged. Gesture names are no longer shown.
- Verified: real hand landmarks from a detected hand (V sign) with the fingers moved together: pinch at 0.15 and 0.25 hand-sizes apart, no new pinch at 0.38 but an existing hold survives, released at 0.55, the real V sign (0.74) is not a pinch, curled fingertips touching are not a pinch; logic test for the ball store (pickup reach, nearest ball, no sweep-up, follow, drop, merge to the right hand, no instant left re-pick, hand leaving view, 20,000-step randomized invariant test) passes; screenshot with a forced pinch shows "Ball held" with green dots; `npm run build` and `npm run lint` pass; no console errors. NOT verified: pinching with real fingers on the live webcam, and how well the 0.3 / 0.45 thresholds suit different hands and distances from the camera.

## thumb-index-pinch

- Worked on `main`; no commits made.
- The pick-up gesture is now thumb tip (landmark 4) touching index fingertip (landmark 8), replacing index plus middle finger. `pinchPoint` is the midpoint of those two tips, and the ball follows it.
- Modified `frontend/src/handTracking.ts`: `isPinching` now measures the thumb-to-index tip distance in hand sizes (closes below 0.3, stays closed until 0.45, flips after 2 consecutive frames, as before). The "both fingers straight" rule was replaced because a real pinch curls the index to meet the thumb: the index tip must now stay away from the palm (farther from the wrist than 1.2 times its knuckle to start, 1.05 to keep holding), which still stops a closed fist from counting. Removed the unused middle-fingertip constant.
- Modified `frontend/src/Camera.tsx`: the two larger key dots are now the thumb tip and index tip. `frontend/src/balls.ts`: comments only; ball rules (reach, nearest ball, merge to the right hand, snap to the grid) are unchanged.
- Verified: on real landmarks from a detected hand with the thumb moved into place: pinch at 0.1, 0.2 and 0.28 hand-sizes, no new pinch at 0.38 but an existing hold survives, released at 0.55, a real open hand is not a pinch, a pinch with the index curled to 70% and 55% still counts, and a fist-like pose (index folded in, thumb touching) does not start a pinch; `npm run build` and `npm run lint` pass; no console errors. NOT verified: pinching with a real hand on the live webcam; the 0.3 / 0.45 and 1.2 / 1.05 thresholds may need tuning for different hands. A fist already holding a ball would drop it once the index tip is pulled below 1.05 times its knuckle distance (real fists are expected to be well below that).

## cannons

- Built in worktree branch `worktree-cannons` and merged into `main`.
- New `frontend/src/cannons.ts`: one cannon per grid column (`LANES` = 10) along the top edge. Releasing a held ball over a free cannon tile (`tryLoadCannon`, hooked into the release branch of `updateBalls` in `balls.ts`) removes the ball. The cannon then charges for `FIRE_DELAY` = 1.5s and fires; the shot travels down the lane for 1.4s and disappears just above the shoreline (no target collision yet). A cannon can be reloaded as soon as it has fired. `stepCannons(dt, held, cw, ch)` also marks the tile a held ball is hovering over.
- New `frontend/src/CannonScene.tsx` (three.js): cannon models (plate, breech, tapered barrel, bands, muzzle ring) scaled to the tile size every frame so they fit their column at any window size; charge lamp that blinks faster as it nears firing, with a glow; tile outline that turns green on hover and pulses amber while charging; barrel recoil on firing; muzzle explosion (additive flash, 18 sparks, smoke puff, 0.55s); shots rendered as numbered iron balls that start small and grow as they travel down the lane.
- New `frontend/src/ironTextures.ts`: the iron ball texture code moved out of `HandZoneBalls.tsx` so shots reuse it (no behavior change). `HandZoneBalls.tsx` now mounts `<Cannons />`; `balls.ts` takes its column count from `LANES`.
- Verified: `tsc`, `oxlint` and `vite build` pass; a Node script on `cannons.ts` showed an off-tile drop is ignored, a tile drop loads the cannon, a busy cannon rejects a second ball, the shot spawns at about 1.5s, finishes at about 2.9s, and the cannon is free again. NOT verified: the look of the cannons and explosion in a browser, or dropping with real hands on the webcam.

## single-row-cannons-up

- Built in worktree branch `worktree-single-row` and merged into `main`.
- `frontend/src/balls.ts`: the ball grid is now one row of 10 slots (`ROWS = 1`, `MAX_BALLS = 10`) near the bottom of the screen (`BALL_ROW_Y` = 0.88 of the height, ball radius unchanged at 0.44 of a column). New balls spawn only as 1, 2 or 3 (`BALL_VALUES = [1, 2, 3]`), and the starting rack is 1, 2, 3 in the middle of the row, so every larger number can be built by merging.
- `frontend/src/cannons.ts`: the cannons moved from the top edge to directly above the ball row, one tile above each slot, and fire up the screen (toward the top, away from the player). The drop zone is the cannon tile (within 0.65 of a cell of its center), so releasing a ball in its own row does not load a cannon. Shots now travel 1.6s, from the muzzle to near the top (y = 0.12). Same 1.5s charge before firing.
- `frontend/src/CannonScene.tsx`: cannon model rotated half a turn so the barrel points up, muzzle sparks and smoke spray upward, recoil kicks toward the player, and shots shrink as they fly away instead of growing.
- Verified: `tsc`, `oxlint` and `vite build` pass; Node script on the stores: start rack 1@3 2@4 3@5, after 40s the row is full at 10 balls in one row with only values 1, 2, 3 seen, a ball dragged to the tile above it loads that cannon with its value, the shot moves upward from y 0.617 to 0.120, and dropping a ball in place keeps it in the row. At 1920x1080 the ball row bottom is at 1035 of 1080 px and the tile bottom (847) clears the ball tops (866). NOT verified: how it looks in a browser, or with real hands. The row position is a fraction of the height, so on very wide, short windows the balls may sit closer to the bottom edge.

## realistic-beach

- Built in worktree branch `worktree-realistic-beach` and merged into `main`.
- New `frontend/src/BeachShader.tsx`: the sea, shoreline and sand are now one full-screen three.js fragment shader that ray-casts a flat ground plane per pixel, so the beach has real perspective (horizon at about 9% from the top, waterline at 2/3 down, matching the hand zone divider). Sea: three rolling swells plus choppy ripples, sky reflection with a Fresnel falloff, a dim sun glint, whitecaps on crests, flattening and haze toward the horizon, clear green-grey shallows with the sand showing through, and a foam wash line that moves in and out. Sand: dunes, wind ripples and grain lit from a low sun with bump shading, a wet glossy band along the water that follows the wash line, lacy foam left on it, and a few pebbles and shell fragments. Animated by time; no textures or downloads.
- Modified `frontend/src/BeachScene.tsx`: removed the CSS water gradient, scrolling wave lines, ripples, sand tint and noise, and the SVG shoreline; they are replaced by `<BeachShader />`. Ships, wrecks, fog, particles and the vignette are unchanged and sit on top. (`beach.css` keeps now-unused wave classes.)
- Rendered at 1x device pixel ratio with antialiasing off to stay cheap next to hand tracking; the sea is soft by design.
- Verified: `tsc`, `oxlint` and `vite build` pass; headless Chrome (software GL) screenshots at 1280x720 and 1920x1080 show the perspective sea, glint, foam, wet sand, ships on the horizon and the cannons and balls on top, with no shader errors. NOT verified: frame rate on a real GPU alongside the webcam hand tracking, or how it looks next to live hands. The foreground sand is soft rather than crisp, and the dark cannon tile plates are unchanged.
