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
