import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// SparkBuild Direct, the built-in B2C org. drizzle/0014 seeds it with this
// fixed id so app code can name it without a lookup, and every row that
// existed before organizations did was backfilled to it. Until D2 resolves
// the org from the host, it is also where every new sign-in lands (the
// users.org_id column default).
export const DIRECT_ORG_ID = '00000000-0000-4000-8000-000000000001'
export const DIRECT_ORG_SLUG = 'app'

// A tenant: SparkBuild Direct or one school. `slug` is the subdomain the org
// will answer on (D2), so it is DNS-label shaped. Orgs are suspended, never
// deleted, which is why nothing cascades from here.
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check('organizations_status_check', sql`${t.status} = ANY (ARRAY['active', 'suspended'])`),
    check('organizations_slug_check', sql`${t.slug} ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'`),
  ]
)
