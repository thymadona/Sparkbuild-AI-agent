import { eq, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema'

export { DIRECT_ORG_ID, DIRECT_ORG_SLUG } from '@/lib/db/schemas/organizations'

// A row that belongs to a user (an invoice, a role grant) lives in that
// user's org. Used as an insert value, this resolves the org in the same
// statement, so there is no read-then-write gap; an unknown user yields NULL
// and the insert fails on the NOT NULL / FK rather than landing in some org.
export function orgOfUser(userId: string) {
  return sql<string>`(select ${users.orgId} from ${users} where ${eq(users.id, userId)})`
}
