import { db } from '@/lib/db/client'
import { prompts } from '@/lib/db/schema'
import { aiRequestsByOrg, aiRequestsByUser, estimateCost, getAiUsage } from '@/lib/ai-usage'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { makeOrg, makeUser, resetDb } from '@/__tests__/helpers/db'

// AI usage is the platform owner's alone (only /console reads it); these pin
// that one org's counts don't include another's.
beforeEach(resetDb)
afterAll(() => db.$client.end())

const old = new Date(Date.now() - 3 * 86_400_000).toISOString()

async function seed() {
  const school = await makeOrg()
  const direct = await makeUser()
  const other = await makeUser({ orgId: school.id })
  await db.insert(prompts).values([
    { userId: direct.id, content: 'a' },
    { userId: direct.id, content: 'b', createdAt: old },
    { userId: other.id, content: 'c' },
  ])
  return { school, direct, other }
}

describe('getAiUsage', () => {
  it('counts one org through its users', async () => {
    const { school } = await seed()
    expect(await getAiUsage(DIRECT_ORG_ID)).toMatchObject({ today: 1, total: 2 })
    expect(await getAiUsage(school.id)).toMatchObject({ today: 1, total: 1 })
  })

  it('counts the whole platform without an org, with a 14-day trend', async () => {
    await seed()
    const usage = await getAiUsage()
    expect(usage).toMatchObject({ today: 2, total: 3 })
    expect(usage.byDay).toHaveLength(14)
    expect(usage.byDay.at(-1)).toBe(2)
  })
})

it('groups all-time requests by org and by user', async () => {
  const { school, direct, other } = await seed()
  const byOrg = await aiRequestsByOrg()
  expect(byOrg.get(DIRECT_ORG_ID)).toBe(2)
  expect(byOrg.get(school.id)).toBe(1)
  const byUser = await aiRequestsByUser()
  expect(byUser.get(direct.id)).toBe(2)
  expect(byUser.get(other.id)).toBe(1)
})

it('estimates cost', () => {
  expect(estimateCost(0)).toBe('$0.00')
  expect(estimateCost(1)).toBe('<$0.01')
  expect(estimateCost(1000)).toBe('$2.10')
})
