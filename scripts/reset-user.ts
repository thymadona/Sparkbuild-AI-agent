import { count, eq, inArray } from 'drizzle-orm'
import { invalidate } from '@/lib/cache'
import { db } from '@/lib/db/client'
import {
  activityDays,
  lessonProgress,
  messages,
  projects,
  prompts,
  taskProgress,
  users,
} from '@/lib/db/schema'
import { redis } from '@/lib/redis'

// Puts an account back to "brand new student" so a tester can replay the
// course from week 1 on the same Google login. It wipes the learning state
// (projects/boards, lesson_progress, task_progress, messages, prompts,
// activity_days) and keeps the account itself: users, sessions, accounts,
// student_profiles, user_roles, class_members, invoices and receipts.
//
// XP, level and badges have no rows of their own — lib/xp.ts derives them
// from lesson_progress — so they reset with it.
//
// Dry run unless --yes is passed:
//   bun run db:reset:user tester@example.com          # counts only
//   bun run db:reset:user tester@example.com --yes    # wipes
//
// An open /board tab still holds the deleted project in client state; reload it.

export interface ResetSummary {
  userId: string
  email: string
  projects: number
  completedTasks: number
  taskProgress: number
  messages: number
  prompts: number
  activityDays: number
  deleted: boolean
}

export async function resetUser(
  rawEmail: string,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<ResetSummary> {
  const email = rawEmail.trim().toLowerCase()
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (!user) throw new Error(`No user with email ${email}`)

  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, user.id))
  const projectIds = owned.map((p) => p.id)

  const progress = projectIds.length
    ? await db
        .select({ ids: lessonProgress.completedTaskIds })
        .from(lessonProgress)
        .where(inArray(lessonProgress.projectId, projectIds))
    : []
  const [[tasks], [msgs], [prm], [days]] = await Promise.all([
    projectIds.length
      ? db
          .select({ n: count() })
          .from(taskProgress)
          .where(inArray(taskProgress.projectId, projectIds))
      : [{ n: 0 }],
    db.select({ n: count() }).from(messages).where(eq(messages.userId, user.id)),
    db.select({ n: count() }).from(prompts).where(eq(prompts.userId, user.id)),
    db.select({ n: count() }).from(activityDays).where(eq(activityDays.userId, user.id)),
  ])

  const summary: ResetSummary = {
    userId: user.id,
    email,
    projects: projectIds.length,
    completedTasks: progress.reduce((sum, p) => sum + p.ids.length, 0),
    taskProgress: tasks.n,
    messages: msgs.n,
    prompts: prm.n,
    activityDays: days.n,
    deleted: false,
  }
  if (dryRun) return summary

  await db.transaction(async (tx) => {
    // prompts.project_id has no ON DELETE CASCADE, so prompts go before projects.
    await tx.delete(prompts).where(eq(prompts.userId, user.id))
    // Cascades to lesson_progress, task_progress and messages.
    await tx.delete(projects).where(eq(projects.userId, user.id))
    await tx.delete(activityDays).where(eq(activityDays.userId, user.id))
  })

  // Stale cache would otherwise serve the old progress for up to 15s, and the
  // tester's hourly tutor-turn budget starts fresh with the course.
  await Promise.all(projectIds.map((id) => invalidate(`lesson-progress:${id}`)))
  await invalidate(`ratelimit:prompts:${user.id}`)

  return { ...summary, deleted: true }
}

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)'
  } catch {
    return '(unparseable DATABASE_URL)'
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const email = args.find((a) => !a.startsWith('--'))
  const confirmed = args.includes('--yes')

  try {
    if (!email) {
      throw new Error('Usage: bun run db:reset:user <email> [--yes]')
    }

    console.log(`database: ${databaseHost()}`)
    const s = await resetUser(email, { dryRun: !confirmed })
    console.log(`user:     ${s.email} (${s.userId})`)
    console.log(`  projects:        ${s.projects}`)
    console.log(`  completed tasks: ${s.completedTasks}`)
    console.log(`  task_progress:   ${s.taskProgress}`)
    console.log(`  messages:        ${s.messages}`)
    console.log(`  prompts:         ${s.prompts}`)
    console.log(`  activity days:   ${s.activityDays}`)
    console.log(
      s.deleted
        ? '\nDone. The account is back to a fresh student; reload any open /board tab.'
        : '\nDry run — nothing deleted. Re-run with --yes to wipe.'
    )
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    await db.$client.end()
    redis?.disconnect()
  }
}

// A function rather than top-level await: Jest compiles this file to CommonJS
// when the integration test imports resetUser.
if (process.argv[1]?.endsWith('reset-user.ts')) void main()
