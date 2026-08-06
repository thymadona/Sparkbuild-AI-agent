import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Uses the Supabase service-role Postgres connection (session/transaction
// pooler) — this bypasses RLS the same way supabaseAdmin does, so callers
// are responsible for their own ownership checks, same as elsewhere in the
// codebase. Not for use in Client Components.
const connectionString = process.env.DATABASE_URL!

// `prepare: false` is required for Supabase's "Transaction" pool mode,
// which doesn't support prepared statements.
const client = postgres(connectionString, { prepare: false })

export const db = drizzle({ client, schema })
