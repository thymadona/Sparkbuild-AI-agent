import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  activityDays,
  lessonProgress,
  messages,
  projects,
  prompts,
  studentProfiles,
  taskProgress,
  users,
} from '@/lib/db/schema'
import { resetUser } from '@/scripts/reset-user'
import { makeProject, makeStudentProfile, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(resetDb)

async function seedLearner() {
  const user = await makeUser()
  await makeStudentProfile(user.id)
  const project = await makeProject(user.id)
  await db
    .insert(lessonProgress)
    .values({ projectId: project.id, completedTaskIds: ['first-words', 'name-tag'] })
  await db.insert(taskProgress).values({ projectId: project.id, taskId: 'first-words' })
  await db
    .insert(messages)
    .values({ projectId: project.id, userId: user.id, role: 'user', content: 'hi' })
  await db.insert(prompts).values({ projectId: project.id, userId: user.id, content: 'hi' })
  await db.insert(activityDays).values({ userId: user.id, day: '2026-09-20' })
  return user
}

const rowsFor = async (userId: string) => ({
  projects: (await db.select().from(projects).where(eq(projects.userId, userId))).length,
  messages: (await db.select().from(messages).where(eq(messages.userId, userId))).length,
  prompts: (await db.select().from(prompts).where(eq(prompts.userId, userId))).length,
  activityDays: (await db.select().from(activityDays).where(eq(activityDays.userId, userId)))
    .length,
})

describe('resetUser', () => {
  it('counts without deleting on a dry run', async () => {
    const user = await seedLearner()
    const summary = await resetUser(user.email, { dryRun: true })
    expect(summary).toMatchObject({
      projects: 1,
      completedTasks: 2,
      taskProgress: 1,
      messages: 1,
      prompts: 1,
      activityDays: 1,
      deleted: false,
    })
    expect(await rowsFor(user.id)).toEqual({
      projects: 1,
      messages: 1,
      prompts: 1,
      activityDays: 1,
    })
  })

  it('wipes one learner’s state, keeps the account and leaves others alone', async () => {
    const user = await seedLearner()
    const other = await seedLearner()

    const summary = await resetUser(`  ${user.email.toUpperCase()} `)
    expect(summary.deleted).toBe(true)

    expect(await rowsFor(user.id)).toEqual({
      projects: 0,
      messages: 0,
      prompts: 0,
      activityDays: 0,
    })
    expect(await db.select().from(lessonProgress)).toHaveLength(1)
    expect(await db.select().from(taskProgress)).toHaveLength(1)
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1)
    expect(
      await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id))
    ).toHaveLength(1)

    expect(await rowsFor(other.id)).toEqual({
      projects: 1,
      messages: 1,
      prompts: 1,
      activityDays: 1,
    })
  })

  it('throws for an unknown email', async () => {
    await expect(resetUser('nobody@example.test')).rejects.toThrow('No user with email')
  })
})
