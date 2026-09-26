import { count, eq, sql } from 'drizzle-orm'
import { db, rowsOf } from '@/lib/db/client'
import { prompts, users } from '@/lib/db/schema'

export { estimateCost } from './ai-cost'

// AI request counts and their estimated cost. Platform-owner only: call these
// from /console pages (app/console/layout.tsx checks isPlatformAdmin), never
// from /staff. Org admins and teachers see no AI usage or cost.

export interface AiUsage {
  today: number
  total: number
  // 14 entries, oldest first, zero-filled.
  byDay: number[]
}

// Requests in the last 24h, all time, and per day for two weeks: one org's
// (through its users), or the whole platform's without an orgId.
export async function getAiUsage(orgId?: string): Promise<AiUsage> {
  const inOrg = orgId
    ? sql`and ${prompts.userId} in (select ${users.id} from ${users} where ${users.orgId} = ${orgId})`
    : sql``
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

  const [totals, trend] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from ${prompts}
          where ${prompts.createdAt} >= ${dayAgo} ${inOrg})::int as today,
        (select count(*) from ${prompts} where true ${inOrg})::int as total
    `),
    db.execute(sql`
      select array_agg(cnt order by day) as by_day from (
        select gs.day::date as day, count(${prompts.id})::int as cnt
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') gs(day)
        left join ${prompts} on ${prompts.createdAt}::date = gs.day ${inOrg}
        group by gs.day
      ) t
    `),
  ])

  const row = rowsOf<{ today: number | null; total: number | null }>(totals)[0]
  return {
    today: row?.today ?? 0,
    total: row?.total ?? 0,
    byDay: rowsOf<{ by_day: number[] | null }>(trend)[0]?.by_day ?? [],
  }
}

// All-time requests per org, for the console's org list.
export async function aiRequestsByOrg(): Promise<Map<string, number>> {
  const rows = await db
    .select({ orgId: users.orgId, n: count() })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.userId))
    .groupBy(users.orgId)
  return new Map(rows.map((r) => [r.orgId, Number(r.n)]))
}

// All-time requests per user, for the console's student list.
export async function aiRequestsByUser(): Promise<Map<string, number>> {
  const rows = await db
    .select({ userId: prompts.userId, n: count() })
    .from(prompts)
    .groupBy(prompts.userId)
  return new Map(rows.map((r) => [r.userId, Number(r.n)]))
}
