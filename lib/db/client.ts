import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

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

// Timestamps are ISO strings throughout this codebase, and two places compare
// them as strings (`updatedAt >= weekAgo` in app/staff/TeacherOverviewTab.tsx,
// `due_date < today` in the finance views), so the format is load-bearing.
// Left to defaults, node-postgres returns Date objects and parses `date` in
// local time, shifting every invoice a day on a UTC+n machine.
const toIso = (x: string) =>
  new Date(/[+-]\d{2}(:?\d{2})?$|Z$/.test(x) ? x : x + "Z").toISOString();

const PARSERS: Record<number, (x: string) => string> = {
  1184: toIso, // timestamptz
  1114: toIso, // timestamp
  1082: (x) => x, // date — keep YYYY-MM-DD; a Date round-trip shifts it
};

for (const [oid, parser] of Object.entries(PARSERS)) {
  pg.types.setTypeParser(Number(oid), parser);
}

// drizzle-orm/node-postgres sets a *per-query* types.getTypeParser returning
// raw wire text for these OIDs, which bypasses the module-level parsers above.
// Rewriting its query config is the only hook that covers every Drizzle query
// without annotating ~60 schema columns.
function withOurParsers<T extends { types?: unknown }>(config: T): T {
  const inherited = (
    config.types as { getTypeParser?: (o: number, f?: unknown) => unknown }
  )?.getTypeParser;
  return {
    ...config,
    types: {
      getTypeParser: (oid: number, format?: unknown) =>
        PARSERS[oid] ??
        inherited?.(oid, format) ??
        pg.types.getTypeParser(oid, format as never),
    },
  };
}

// node-postgres, not postgres.js. Against Supabase's pooler, postgres.js loses
// queries on reused pooled connections — they never settle and never reject.
// Measured at 8 concurrent queries x 3 rounds: postgres.js dropped 6,
// node-postgres 0. That is what hung /staff and every /staff/* page in
// production while being invisible against a local Postgres.
const createPool = () =>
  new pg.Pool({
    connectionString,
    // Serverless scales instances, not in-instance concurrency. `max: 1` in
    // dev makes a leaked pool obvious instead of silently absorbed.
    max: isProd ? 5 : 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 15_000,
  });

// Without this, each dev HMR pass leaks a pool. Kept in production too: a warm
// instance re-evaluating this module would open a second pool against the same
// pooler budget.
const globalForDb = globalThis as unknown as { __pg?: pg.Pool };
const pool = globalForDb.__pg ?? createPool();
globalForDb.__pg = pool;

const baseQuery = pool.query.bind(pool);
pool.query = ((config: unknown, ...rest: unknown[]) =>
  baseQuery(
    (config && typeof config === "object"
      ? withOurParsers(config as { types?: unknown })
      : config) as never,
    ...(rest as []),
  )) as typeof pool.query;

// Poolers drop idle backends routinely; without a listener that is an
// unhandled 'error' event and takes the process down.
pool.on("error", (err) => {
  console.error("pg pool error (connection discarded):", err.message);
});

// Host and port only, never credentials. A Vercel env-var change does not
// apply to an already-deployed function, so this is how you confirm which
// database a deployment actually reached.
if (!isTest) {
  try {
    const u = new URL(connectionString);
    console.log(
      `[db] ${u.hostname}:${u.port || "5432"}${u.pathname} pool_max=${isProd ? 5 : 1}`,
    );
  } catch {
    console.log("[db] connection string is not a parseable URL");
  }
}

export const db = drizzle({ client: pool, schema });

/**
 * Rows from a `db.execute()` result. node-postgres returns a `QueryResult`
 * with rows under `.rows`; postgres.js returned the array itself.
 *
 * Every call site feeds an authorization check that fails closed, so reading
 * the wrong shape does not throw — it denies the permission and locks staff
 * out, with nothing failing at compile time.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
