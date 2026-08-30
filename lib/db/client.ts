import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// The single Postgres connection for the whole app. It connects as the
// database owner and therefore bypasses RLS, so callers are responsible for
// their own ownership checks — every scoped query needs its own predicate,
// e.g. `.where(and(eq(t.id, id), eq(t.user_id, session.user.id)))`. Dropping
// the second clause is a horizontal privilege escalation, not a missing
// filter. Not for use in Client Components.
const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

// Under Jest every suite talks to TEST_DATABASE_URL, which the test harness
// migrates and truncates freely (see jest.globalSetup.ts and
// __tests__/helpers/db.ts). The equality guard below is the thing standing
// between a `bun run test` and a truncated development database, so it
// refuses to run rather than falling back to DATABASE_URL.
const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    isTest
      ? 'TEST_DATABASE_URL is not set. Tests run against their own database — ' +
        'add it to .env (see .env.local.example) and run `bun run db:migrate:test`.'
      : 'DATABASE_URL is not set. Copy .env.local.example to .env and fill it in — ' +
        'without it every database read and write fails at connect time.'
  )
}

if (isTest && connectionString === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL and DATABASE_URL point at the same database. The test ' +
      'harness truncates every table between suites — refusing to run against ' +
      'the development database.'
  )
}

const createClient = () =>
  postgres(connectionString, {
    // Not needed for a direct connection, but it is what lets the same code
    // run unchanged against a pooler in "Transaction" mode, which doesn't
    // support prepared statements.
    prepare: false,
    // Pin the session zone so date/time rendering and `current_date` don't
    // depend on the host's locale — otherwise the same query yields
    // different offsets on a developer laptop and on a server.
    connection: { TimeZone: 'UTC' },
    // Serverless scales instances, not in-instance concurrency, so the
    // per-instance pool stays small. `max: 1` in dev makes a leaked pool
    // obvious instead of silently absorbed.
    max: isProd ? 5 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })

// Next's dev server re-evaluates modules on every HMR pass. Without this
// guard each reload leaks a fresh connection pool until Postgres refuses
// new connections. Cache the postgres.js client rather than the Drizzle
// wrapper — re-wrapping a cached client is idempotent.
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof createClient> }
const client = globalForDb.__pg ?? createClient()
if (!isProd) globalForDb.__pg = client

export const db = drizzle({ client, schema })

// Postgres hands timestamps back as JS Date objects by default; this
// codebase types them as ISO strings all the way through (types/index.ts,
// ~62 `new Date(row.created_at)` call sites, JSON API responses), which is
// the shape the previous Supabase/PostgREST client produced.
//
// This has to run *after* `drizzle()`, not as a `types:` option on
// `postgres()`. drizzle-orm/postgres-js's `construct()` overwrites
// `client.options.parsers` for exactly these OIDs with a pass-through so
// that raw Postgres text reaches its own column mappers — see
// node_modules/drizzle-orm/postgres-js/driver.js. Anything passed to
// `postgres()` is silently clobbered. Reinstating the parsers here means
// Drizzle's `mode: 'string'` columns receive an ISO string and hand it
// straight through. Only parsers are touched; the serializers Drizzle sets
// are left alone, since those are how it encodes outbound parameters.
const toIso = (x: string) =>
  // A `timestamp without time zone` carries no offset. Values are stored as
  // UTC here, so say so explicitly rather than letting `new Date()` read
  // them as server-local time.
  new Date(/[+-]\d{2}(:?\d{2})?$|Z$/.test(x) ? x : x + 'Z').toISOString()

client.options.parsers[1184] = toIso // timestamptz
client.options.parsers[1114] = toIso // timestamp
// date (1082) is deliberately left as Postgres's own YYYY-MM-DD text.
// invoices.due_date is compared as a string against
// `new Date().toISOString().split('T')[0]` in the staff views; routing it
// through Date would shift it across timezones and break those comparisons.
client.options.parsers[1082] = (x: string) => x
