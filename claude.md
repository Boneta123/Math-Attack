# Number Rush — Project Instructions

## Project Overview

Build a webcam-controlled arcade math game called **Number Rush**. Players use hand gestures to grab and combine numbered balls to create a target number. They must throw the correct number at an incoming enemy ball before it reaches them.

The goal is to create a fun, responsive game that combines arithmetic, hand tracking, and arcade-style visuals. This project is intended for a 24-hour hackathon, so prioritize a working and polished core gameplay loop over unnecessary features.

## Tech Stack

### Frontend

- **React** — UI components, menus, score display, timers, and game state.
- **TypeScript** — Type safety and maintainable code.
- **Vite** — Frontend development server and build tooling.
- **Three.js** — 3D game objects, lighting, perspective, animations, and particle effects.
- **React Three Fiber** — Integrate Three.js scenes naturally into React.
- **React Three Drei** — Helpful utilities for React Three Fiber.
- **MediaPipe Hand Landmarker** (`@mediapipe/tasks-vision`) — Real-time webcam hand tracking in the browser.
- **Browser MediaDevices API** — Access the webcam using `getUserMedia()`.

### Backend

- **Python** — Backend language.
- **FastAPI** — REST API for account management, score submission, and leaderboard retrieval.
- **Uvicorn** — ASGI server for running FastAPI.
- **Supabase PostgreSQL** — Persistent database for user profiles and high scores.

### Hosting

- **Vercel** — Host the React frontend.
- **Python-compatible hosting provider** — Host the FastAPI backend.
- **Supabase** — Host the PostgreSQL database.

Do not introduce additional frameworks or services unless they solve a concrete problem.

## Architecture

Keep the frontend and backend separate.

### Frontend responsibilities

1. Display the webcam feed.
2. Run MediaPipe hand tracking locally in the browser.
3. Render the game using React Three Fiber and Three.js.
4. Detect hand gestures and translate them into game interactions.
5. Handle arithmetic, collisions, animations, and round progression.
6. Display scores, timers, lives, the current operation, and the target number.
7. Send account and leaderboard requests to the FastAPI backend.

### Backend responsibilities

1. Register users and handle login.
2. Store password hashes securely rather than plaintext passwords.
3. Verify credentials and issue a secure authentication token or session.
4. Save completed game scores.
5. Retrieve leaderboard data.
6. Validate requests and prevent users from modifying other users' records.

### Database responsibilities

Use Supabase PostgreSQL to persist account and leaderboard data.

Keep database access credentials on the backend. Never expose the Supabase service-role key or other server secrets to the frontend.

## MediaPipe and Camera

MediaPipe should run directly in the browser. **Do not send webcam frames to FastAPI for hand tracking.**

Use the following flow:

1. Request webcam access through `navigator.mediaDevices.getUserMedia()`.
2. Display the camera feed in a video element.
3. Pass video frames to MediaPipe Hand Landmarker.
4. Read the hand landmarks and estimate the pinch state.
5. Pass the latest hand position and gesture state to the game interaction system.
6. Update the rendered objects accordingly.

Use the thumb tip and index fingertip to detect a pinch gesture. Apply smoothing and a small threshold buffer to reduce jitter and accidental grabbing.

Provide clear instructions when camera access is denied or no hand is detected. Include a mouse-based fallback so the game remains playable during development and demos.

## Rendering and Game Display

Use a layered game interface:

- **Background:** Live webcam video.
- **Game scene:** Three.js objects rendered over the camera feed.
- **HUD:** React interface showing the target, operation, score, timer, lives, and instructions.

This is simulated AR, not true spatial AR. Virtual objects do not need to be anchored to real-world surfaces.

Use Three.js perspective and object scaling to make balls appear to approach the player. Avoid unnecessary real-world 3D reconstruction.

Ensure that the webcam, game canvas, and hand coordinates remain aligned, including when the video is mirrored.

## Core Gameplay

### 1. Incoming target

- Spawn a large numbered ball that approaches the player.
- Increase its apparent size as it gets closer.
- Show the target value clearly.
- Display the active arithmetic operation.
- End the round or remove a life if the ball reaches the player.

### 2. Available number balls

- Display several numbered balls near the bottom of the screen.
- Allow the player to grab a ball using a pinch gesture.
- Move the selected ball with the player's hand.
- Give clear visual feedback when an object is selected.

### 3. Combining numbers

- Drag one ball onto another to combine their values using the active operation.
- Remove the original balls and create a new ball containing the result.
- Support addition first.
- Add subtraction, multiplication, and division after the core gameplay works.
- Decide and enforce rules for negative results, division by zero, and non-integer results.
- Generate puzzles that can actually be solved using the available numbers.

### 4. Throwing

- Allow the player to grab and throw a completed number toward the incoming target.
- Use the hand's movement to determine the throw direction and speed where practical.
- Detect collisions between the thrown ball and the incoming target.
- A correct match destroys or neutralizes the target.
- A wrong match should provide understandable feedback.

### 5. Scoring and progression

- Award points for successful hits.
- Optionally reward quick solutions and fewer combinations.
- Increase difficulty as the player progresses.
- Change the active arithmetic operation between rounds.
- Track the player's current score and best score.

Keep the rules clear and consistent. Prioritize addition and exact target matching for the initial playable version.

## Database Design

Use PostgreSQL tables with appropriate constraints.

### Profiles

- `id` — Unique user ID.
- `username` — Unique public username.
- `created_at` — Account creation timestamp.

### Scores

- `id` — Unique score record ID.
- `user_id` — Foreign key referencing the account.
- `score` — Score achieved.
- `created_at` — Timestamp of the completed round.

Store password hashes separately from public profile information. Use a suitable password-hashing library and validate all authentication inputs.

The leaderboard should retrieve the highest scores and display usernames. Decide whether it shows each player's personal best or their best individual rounds.

## API Design

Use FastAPI endpoints along these lines:

- `POST /api/auth/register` — Create an account.
- `POST /api/auth/login` — Verify credentials and establish a session.
- `GET /api/auth/me` — Return the current user's profile.
- `POST /api/scores` — Submit a completed score.
- `GET /api
