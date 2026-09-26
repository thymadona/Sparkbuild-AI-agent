import { db } from '@/lib/db/client'
import { classEnabledLessons } from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import { getAvailableLessonIdsForUser, selfPacedLessonIds } from '@/lib/lesson-availability'
import {
  addClassMember,
  makeClass,
  makeProject,
  makeUser,
  resetDb,
  setLessonProgress,
} from '@/__tests__/helpers/db'

beforeEach(resetDb)
afterAll(() => db.$client.end())

const bossOf = (i: number) => LESSONS[i].tasks.find((t) => t.boss)!.id
const ids = (n: number) => LESSONS.slice(0, n).map((l) => l.id)

async function beatBoss(userId: string, i: number) {
  const project = await makeProject(userId, { lessonId: LESSONS[i].id })
  await setLessonProgress(project.id, [bossOf(i)], new Date().toISOString())
}

describe('selfPacedLessonIds', () => {
  it('opens only the first lesson for a new student', () => {
    expect(selfPacedLessonIds(new Set())).toEqual(ids(1))
  })

  it('opens each next lesson once the boss before it is beaten', () => {
    expect(selfPacedLessonIds(new Set(ids(2)))).toEqual(ids(3))
  })

  it('stops at the first lesson whose boss is not beaten, even if a later one is', () => {
    expect(selfPacedLessonIds(new Set([LESSONS[0].id, LESSONS[2].id]))).toEqual(ids(2))
  })
})

describe('getAvailableLessonIdsForUser', () => {
  it('gives a student in no class the first lesson', async () => {
    const student = await makeUser()
    expect([...(await getAvailableLessonIdsForUser(student.id))]).toEqual(ids(1))
  })

  it('keeps the next lesson locked until the boss is beaten, not just any task', async () => {
    const student = await makeUser()
    const project = await makeProject(student.id, { lessonId: LESSONS[0].id })
    const notBoss = LESSONS[0].tasks.find((t) => !t.boss)!.id
    await setLessonProgress(project.id, [notBoss], new Date().toISOString())
    expect(await getAvailableLessonIdsForUser(student.id)).toEqual(new Set(ids(1)))

    await beatBoss(student.id, 0)
    expect(await getAvailableLessonIdsForUser(student.id)).toEqual(new Set(ids(2)))
  })

  it('adds lessons a class turned on without taking self-paced ones away', async () => {
    const student = await makeUser()
    const klass = await makeClass()
    await addClassMember(klass.id, student.id, 'student')
    const last = LESSONS[LESSONS.length - 1].id
    await db.insert(classEnabledLessons).values({ classId: klass.id, lessonId: last })

    expect(await getAvailableLessonIdsForUser(student.id)).toEqual(new Set([...ids(1), last]))
  })

  it('never opens a lesson from another student’s progress', async () => {
    const student = await makeUser()
    const other = await makeUser()
    await beatBoss(other.id, 0)

    expect(await getAvailableLessonIdsForUser(student.id)).toEqual(new Set(ids(1)))
  })
})
