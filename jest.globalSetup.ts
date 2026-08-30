import { execFileSync } from 'node:child_process'

// Brings TEST_DATABASE_URL up to the current drizzle/ history once, before
// any suite runs, so tests can never execute against a stale schema.
//
// This shells out to the same `db:migrate:test` script CI and humans use,
// rather than importing a migrate helper: globalSetup is loaded by Node's
// ESM loader *outside* jest's transform and moduleNameMapper, so neither
// `@/` aliases nor relative TypeScript imports resolve from here.
export default async function globalSetup() {
  execFileSync('bun', ['run', 'db:migrate:test'], { stdio: 'inherit' })
}
