import { defineConfig } from 'drizzle-kit'

// Schema is database-first: source of truth for the schema shape is
// supabase/migrations/*.sql, applied via the Supabase CLI. `bun run db:pull`
// introspects the live DB into lib/db/schema.ts for typed queries — don't
// run `drizzle-kit generate`/`push` against this config, it would create a
// second, competing migration history.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
