import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { db, rowsOf } from '@/lib/db/client'
import { invoices, projects, sessions } from '@/lib/db/schema'
import { makeUser, resetDb } from '@/__tests__/helpers/db'

// Pins the driver's wire behaviour. node-postgres returns Date objects by
// default and parses `date` in local time, so '2026-01-01' would become
// 2025-12-31 on a UTC+7 machine. Nothing else in the suite catches the parsers
// in lib/db/client.ts regressing.
beforeEach(resetDb)
afterAll(() => db.$client.end())

describe('driver type parsing', () => {
  it('returns timestamptz as an ISO string, not a Date', async () => {
    const user = await makeUser()
    const [row] = await db
      .insert(projects)
      .values({ userId: user.id, title: 'p' })
      .returning({ createdAt: projects.createdAt })

    expect(typeof row.createdAt).toBe('string')
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Number.isNaN(new Date(row.createdAt).getTime())).toBe(false)
  })

  it('returns date as plain YYYY-MM-DD with no timezone shift', async () => {
    const user = await makeUser()
    await db.insert(invoices).values({
      userId: user.id,
      amountCents: 100,
      description: 'x',
      dueDate: '2026-01-01',
    })

    const [row] = await db
      .select({ due: invoices.dueDate })
      .from(invoices)
      .where(eq(invoices.userId, user.id))

    // Not 2025-12-31: the default parser shifts this east of UTC.
    expect(row.due).toBe('2026-01-01')
    expect(typeof row.due).toBe('string')
  })

  it('still gives Better Auth real Date objects for its own tables', async () => {
    const user = await makeUser()
    const expires = new Date(Date.now() + 3_600_000)
    await db.insert(sessions).values({
      userId: user.id,
      token: 'tok-driver-test',
      expiresAt: expires,
    })

    const [row] = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.token, 'tok-driver-test'))

    // Better Auth's four tables keep mode:'date' and read real Dates.
    expect(row.expiresAt).toBeInstanceOf(Date)
    expect(Math.abs(row.expiresAt.getTime() - expires.getTime())).toBeLessThan(1000)
  })
})

describe('rowsOf', () => {
  it('reads rows out of a node-postgres QueryResult', async () => {
    const result = await db.execute(sql`select 1::int as ok`)
    expect(rowsOf<{ ok: number }>(result)[0]?.ok).toBe(1)
  })

  it('passes a bare array through unchanged', () => {
    expect(rowsOf<{ a: number }>([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it('returns an empty array rather than throwing on an unexpected shape', () => {
    // db.execute() sites fail closed, so a wrong shape denies access silently.
    expect(rowsOf(null)).toEqual([])
    expect(rowsOf(undefined)).toEqual([])
    expect(rowsOf({})).toEqual([])
  })
})
