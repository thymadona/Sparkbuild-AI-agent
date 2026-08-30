// Guards route params before they reach a uuid column.
//
// PostgREST used to absorb a malformed id: `.eq('id', 'not-a-uuid')` came back
// as `{ data: null }` and the handler answered 404. Postgres does not — the
// same value reaches the driver as a bind parameter and the server raises
// 22P02 `invalid input syntax for type uuid`, which Drizzle throws and Next
// renders as a 500. A user typing a bad URL is a 404, not a server error, so
// every handler that takes an id from the path checks it here first.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
