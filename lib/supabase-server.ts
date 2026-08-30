import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Data access only — authentication moved to Better Auth (lib/auth/), and the
// anon/browser clients are gone with it. This client remains solely because
// ~38 files still read and write through PostgREST; each one moves to Drizzle
// (`@/lib/db/client`) in the data-layer conversion, and this file disappears
// when the last one does.
//
// Uses the service role key, so it bypasses RLS: every query needs its own
// ownership check, e.g. `.eq('id', id).eq('user_id', user.id)`.
// NEVER import this in client-side code or expose it to the browser.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
