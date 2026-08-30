import { defineConfig } from 'drizzle-kit'

// Same schema and same migration history as drizzle.config.ts — only the
// target database differs. Tests get their own database because the harness
// truncates every table between suites (see __tests__/helpers/db.ts), which
// would otherwise wipe development data.
//
// Applied by `bun run db:migrate:test`, which jest.globalSetup.ts also
// invokes so a test run can never execute against a stale schema.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.TEST_DATABASE_URL!,
  },
  // Each database carries its own ledger — `drizzle.__drizzle_migrations`
  // lives *inside* the target database, so dev and test track what they have
  // applied independently even though both replay the same ./drizzle folder.
  // Stated explicitly (rather than left to the default) so the separation is
  // visible at a glance and can't drift if a default ever changes.
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
})
