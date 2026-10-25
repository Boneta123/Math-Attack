# Math-Attack

AR Like math game.
Used Claude agent to help build aspects of the project.

MediaPipe Install:
npm install @mediapipe/tasks-vision

## Running the Frontend

Requires Node.js and npm.

```bash
# from the repo root
cd frontend

# install dependencies (first time only)
npm install

# start the dev server (http://localhost:5173/)
npm run dev
```

Allow camera access when the browser asks. The page shows your mirrored webcam feed with hand tracking drawn over it.

### Frontend dependencies

All are installed by `npm install` in `frontend/`.

| Package | Purpose |
| --- | --- |
| `react`, `react-dom` | UI |
| `three` | 3D engine |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | Helpers for React Three Fiber |
| `@mediapipe/tasks-vision` | In-browser hand tracking |
| `@types/three` (dev) | TypeScript types for Three.js |

Other commands (run from `frontend/`):

```bash
npm run build     # type-check and build for production
npm run preview   # serve the production build locally
npm run lint      # run oxlint
```
