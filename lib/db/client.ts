import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// The single Postgres connection for the whole app. It connects as the
// database owner and therefore bypasses RLS, so callers are responsible for
// their own ownership checks — every scoped query needs its own predicate,
// e.g. `.where(and(eq(t.id, id), eq(t.user_id, session.user.id)))`. Dropping
// the second clause is a horizontal privilege escalation, not a missing
// filter. Not for use in Client Components.
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

// Under Jest every suite talks to TEST_DATABASE_URL, which the test harness
// migrates and truncates freely (see jest.globalSetup.ts and
// __tests__/helpers/db.ts). The equality guard below is the thing standing
// between a `bun run test` and a truncated development database, so it
// refuses to run rather than falling back to DATABASE_URL.
const connectionString = isTest
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    isTest
      ? "TEST_DATABASE_URL is not set. Tests run against their own database — " +
          "add it to .env (see .env.local.example) and run `bun run db:migrate:test`."
      : "DATABASE_URL is not set. Copy .env.local.example to .env and fill it in — " +
          "without it every database read and write fails at connect time.",
  );
}

if (isTest && connectionString === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL and DATABASE_URL point at the same database. The test " +
      "harness truncates every table between suites — refusing to run against " +
      "the development database.",
  );
}

const createClient = () =>
  postgres(connectionString, {
    // Not needed for a direct connection, but it is what lets the same code
    // run unchanged against a pooler in "Transaction" mode, which doesn't
    // support prepared statements.
    prepare: false,
    connection: {
      TimeZone: "UTC",
      statement_timeout: 15_000,
      idle_in_transaction_session_timeout: 15_000,
    },
    // Serverless scales instances, not in-instance concurrency, so the
    // per-instance pool stays small — and every instance's pool counts
    // against the same pooler budget, so this number is multiplied by however
    // many instances are warm. `max: 1` in dev makes a leaked pool obvious
    // instead of silently absorbed.
    max: isProd ? 2 : 1,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });

// Next's dev server re-evaluates modules on every HMR pass. Without this
// each reload leaks a fresh connection pool until Postgres refuses new
// connections. It is kept in production too: a warm serverless instance that
// re-evaluates this module would otherwise open a second pool against the
// same pooler budget, and `max` above is sized on the assumption that one
// module instance means one pool. Cache the postgres.js client rather than
// the Drizzle wrapper — re-wrapping a cached client is idempotent.
const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof createClient>;
};
const client = globalForDb.__pg ?? createClient();
globalForDb.__pg = client;

export const db = drizzle({ client, schema });

const toIso = (x: string) =>
  new Date(/[+-]\d{2}(:?\d{2})?$|Z$/.test(x) ? x : x + "Z").toISOString();

client.options.parsers[1184] = toIso; // timestamptz
client.options.parsers[1114] = toIso; // timestamp
client.options.parsers[1082] = (x: string) => x;
