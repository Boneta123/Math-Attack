# Number Rush API (Express)

The backend is Express, not the FastAPI named in `claude.md`; the database is still Supabase Postgres.

1. Run `schema.sql` in the Supabase SQL editor.
2. Copy `.env.example` to `.env` and fill in the project URL and service-role key (backend only, never the frontend).
3. `npm install`, then `npm run dev` (port 3001). `npm test` runs the route tests.

Endpoints: `POST /api/players`, `POST /api/scores/:mode`, `POST /api/leaderboard/:mode`,
`GET /api/leaderboard/:mode`, `GET /api/scores/:mode/:username`. Modes: `addition`, `mixed`, `challenge`.
The leaderboard holds the top 25 single-run scores per mode; each player keeps their best 10.
