import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { createApp } from './app.js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT = 3001, FRONTEND_ORIGIN } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).')
  process.exit(1)
}

// The service-role key bypasses RLS, so it stays on this server and is never sent to the browser.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

createApp(supabase, { frontendOrigin: FRONTEND_ORIGIN }).listen(PORT, () => {
  console.log(`Number Rush API on http://localhost:${PORT}`)
})
