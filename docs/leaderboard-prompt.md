<context>
Repo: Number Rush, a webcam arcade math game. Frontend is React 19 + TypeScript + Vite in `frontend/src` (plain module stores with `subscribeX`/`getX` used via `useSyncExternalStore`; inline-style components; screens are `'home' | 'modeSelect' | 'calibrating' | 'playing'` in `frontend/src/game.ts`). There are three game modes in `frontend/src/gameMode.ts`: `addition`, `mixed`, `challenge`. The score lives in `frontend/src/score.ts`; the end screen is `frontend/src/GameOver.tsx`; the in-play HUD is `frontend/src/Hud.tsx`; the start screen is `frontend/src/Home.tsx`.
`claude.md` says the backend is FastAPI. The user has explicitly overridden that: build the backend with Express.js. Supabase PostgreSQL stays as the database.
</context>

<task>
Add a username-based score system backed by Supabase Postgres and an Express API, then wire it into the game UI.

1. DATABASE — write `backend/schema.sql`, idempotent, runnable in the Supabase SQL editor:
   - `players(id uuid pk, username text, created_at)`. Username is the only user data. It MUST be unique case-insensitively (unique index on `lower(username)`) and match `^[A-Za-z0-9_]{3,16}$`.
   - For EACH of the three modes (`addition`, `mixed`, `challenge`) create two tables: `scores_<mode>` (a player's top-10 list: `player_id` FK on delete cascade, `score int > 0`) and `leaderboard_<mode>` (overall top 25 single-run scores across all players, with `player_id`). Six tables total.
   - Two plpgsql functions, `submit_score(p_mode, p_username, p_score)` and `submit_leaderboard(p_mode, p_username, p_score)`. Mode MUST be checked against the whitelist before any dynamic SQL, and table names MUST be built with `format('%I', ...)`. `submit_score` keeps only a player's best 10: insert when the player has fewer than 10 or the score beats their lowest, then trim to 10, and return whether it made the list. `submit_leaderboard` does the same for the top 25 across all players, takes an advisory lock per mode so concurrent calls cannot overfill the board, and MUST only accept a score the player actually has in their `scores_<mode>` list.
   - Enable RLS on every table with no policies, and revoke function execute from `public`, `anon` and `authenticated`. Only the backend's service-role key touches the data.

2. BACKEND — new `backend/` folder (Node, ESM, Express, `@supabase/supabase-js`, `cors`, `dotenv`). Endpoints, and ONLY these:
   - `POST /api/players` `{username}`: create a player. 201 on success, 409 if the name is taken, 400 if invalid.
   - `POST /api/scores/:mode` `{username, score}`: calls `submit_score`.
   - `POST /api/leaderboard/:mode` `{username, score}`: calls `submit_leaderboard`.
   - `GET /api/leaderboard/:mode`: top 25 `{username, score}` rows, highest first.
   - `GET /api/scores/:mode/:username`: that player's top 10, highest first.
   Validate every input (mode whitelist, username regex, score is an integer from 1 to 1,000,000). `createApp(supabase)` MUST accept an injected client so it is testable. CORS is limited to `FRONTEND_ORIGIN`. The service-role key MUST stay on the backend. Add `backend/.env.example` with placeholders only (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `FRONTEND_ORIGIN`).

3. FRONTEND — in `frontend/src`:
   - New `api.ts` (base URL from `import.meta.env.VITE_API_URL`, default `http://localhost:3001`), `player.ts` (username store, persisted in `localStorage` inside try/catch), and `leaderboard.ts` (per-mode cached overall and personal lists, plus the submit flow).
   - Username screen: a new `'username'` screen, shown first when no username is stored. One input, a clear "name taken" error from the 409, Enter submits. On success go to `'home'`.
   - Home: a "Leaderboard" button opening a modal with a tab per game mode, showing the overall top 25 and the player's own top 10. Escape closes it.
   - During play: a compact, translucent, non-interactive panel in `Hud.tsx` below the score showing the top 5 overall and the player's top 5 for the CURRENT mode. It MUST NOT block hand tracking or clicks.
   - On game over (once per run, score > 0): POST the score; if it made the top 10, refresh the leaderboard with GET; if the score is greater than the lowest overall score (or the board has fewer than 25), POST it to the leaderboard. The server re-checks, so the client never decides alone. Show a short result line on the GameOver screen ("New top-10 score", "You made the leaderboard").
   - Network failures MUST NOT break gameplay. Fall back silently and show a brief message.
</task>

<constraints>
- Only make changes directly requested. Do not add auth, passwords, tokens, extra endpoints, extra dependencies or refactors.
- NEVER read, open or write any `.env` file. Placeholders go in `.env.example` only.
- Match the existing code style: comment density, inline styles, store pattern, the gold/cream palette.
- Do not edit the FastAPI text in `claude.md`; note the Express decision in `backend/README.md` (setup and run steps, 10 lines max).
- Stop and ask before: deleting any file, changing game logic files (`balls.ts`, `ships.ts`, `cannons.ts`, `bird.ts`, `difficulty.ts`), or adding a dependency not listed above.
</constraints>

<verification>
- Run `schema.sql` against a scratch local Postgres. Prove: a duplicate username is rejected case-insensitively, the 11th score evicts the lowest, and the 26th leaderboard entry evicts the lowest. A lower score is rejected, and a fabricated score is rejected.
- Test the Express routes with `node --test` against a fake injected client (status codes and validation).
- `cd frontend && npm run build && npm run lint` MUST pass.
- After each step output: ✅ [what was completed]. When finished, list every file created or changed and any assumption you made.
</verification>
