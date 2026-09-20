import { db } from '@/lib/db/client'
import { activityDays, lessonProgress } from '@/lib/db/schema'
import { getPlayerStats, recordActivity } from '@/lib/player-stats'
import { todayISO } from '@/lib/xp'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(resetDb)

const pythonProject = (userId: string, done: string[]) =>
  makeProject(userId, { lessonId: 101, lessonVersion: 3, files: { 'main.py': '' } }).then(async (p) => {
    await db.insert(lessonProgress).values({ projectId: p.id, completedTaskIds: done })
    return p
  })

describe('getPlayerStats', () => {
  it('starts a new student at Rookie with nothing earned', async () => {
    const user = await makeUser()
    expect(await getPlayerStats(user.id)).toMatchObject({ xp: 0, streak: 0, badges: [], level: { name: 'Rookie' } })
  })

  it('adds up XP and badges from this student’s progress only', async () => {
    const user = await makeUser()
    const other = await makeUser()
    await pythonProject(user.id, ['first-words', 'name-tag', 'boot-up'])
    await pythonProject(other.id, ['first-words', 'name-tag', 'fact-file'])

    const stats = await getPlayerStats(user.id)
    expect(stats.xp).toBe(10 + 10 + 40)
    expect(stats.badges).toEqual(['Robot Whisperer'])
    expect(stats.level.name).toBe('Rookie')
  })

  it('ignores projects from the retired web course', async () => {
    const user = await makeUser()
    const p = await makeProject(user.id, { lessonId: 1, lessonVersion: 2, files: { 'index.html': '' } })
    await db.insert(lessonProgress).values({ projectId: p.id, completedTaskIds: ['identity'] })
    expect((await getPlayerStats(user.id)).xp).toBe(0)
  })

  it('reads the streak from activity days', async () => {
    const user = await makeUser()
    await recordActivity(user.id)
    await recordActivity(user.id) // same day twice is still one day
    expect((await db.select().from(activityDays)).length).toBe(1)
    expect((await getPlayerStats(user.id)).streak).toBe(1)
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
