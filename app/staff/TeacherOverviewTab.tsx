import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classes, lessonProgress, projects as projectsTable } from '@/lib/db/schema'
import { getTeacherClassIds } from '@/lib/auth/permissions'
import { getLessonForProject, LESSONS } from '@/lib/lessons'
import { Card, CardContent } from '@/components/ui/card'
import { HeroMetric, MagnitudeBar, Meter, StatChip } from './OverviewWidgets'

const WEEK_MS = 7 * 86_400_000

// Scoped to classes this specific user teaches — getTeacherClassIds already
// filters by user_id, and every query below filters further by studentIds
// derived from those classes, so this never surfaces another teacher's roster.
export default async function TeacherOverviewTab({ userId }: { userId: string }) {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

  const classIds = await getTeacherClassIds(userId)

  if (classIds.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          You&apos;re not assigned to any classes yet.
        </CardContent>
      </Card>
    )
  }

  const [classesData, studentMembers] = await Promise.all([
    db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(inArray(classes.id, classIds)),
    db
      .select({ user_id: classMembers.userId, class_id: classMembers.classId })
      .from(classMembers)
      .where(and(inArray(classMembers.classId, classIds), eq(classMembers.role, 'student'))),
  ])

  const classStudentIds = new Map<string, Set<string>>()
  for (const id of classIds) classStudentIds.set(id, new Set())
  for (const m of studentMembers) classStudentIds.get(m.class_id)?.add(m.user_id)
  const studentIds = Array.from(new Set(studentMembers.map((m) => m.user_id)))

  let lessonsCompleted = 0
  let tasksCompleted = 0
  let activeThisWeek = 0
  const weeklyTotals = new Map<number, { done: number; possible: number }>()
  for (const lesson of LESSONS)
    weeklyTotals.set(lesson.id, { done: 0, possible: studentIds.length * lesson.tasks.length })
  const classTasksCompleted = new Map<string, number>(classIds.map((id) => [id, 0]))

  // 7-day trend of distinct active students per day, oldest first — bucketed
  // from lessonProgress.updatedAt already being fetched below for
  // activeThisWeek, not a new query or a fabricated series.
  const dayKeys: string[] = []
  const activeByDay = new Map<string, Set<string>>()
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().split('T')[0]
    dayKeys.push(day)
    activeByDay.set(day, new Set())
  }

  if (studentIds.length > 0) {
    const projectRows = await db
      .select({
        id: projectsTable.id,
        user_id: projectsTable.userId,
        lesson_id: projectsTable.lessonId,
        lesson_version: projectsTable.lessonVersion,
        updated_at: projectsTable.updatedAt,
      })
      .from(projectsTable)
      .where(and(inArray(projectsTable.userId, studentIds), isNotNull(projectsTable.lessonId)))
      .orderBy(desc(projectsTable.updatedAt))

    const progressById = new Map<string, { completedTaskIds: string[]; updatedAt: string }>()
    if (projectRows.length > 0) {
      // Joined rather than `inArray(projectId, projectRows.map(...))`, which
      // bound one parameter per project row against Postgres's 65535 cap. Same
      // predicate as the query above, so the row set is identical.
      const progressRows = await db
        .select({
          project_id: lessonProgress.projectId,
          completed_task_ids: lessonProgress.completedTaskIds,
          updated_at: lessonProgress.updatedAt,
        })
        .from(lessonProgress)
        .innerJoin(projectsTable, eq(projectsTable.id, lessonProgress.projectId))
        .where(and(inArray(projectsTable.userId, studentIds), isNotNull(projectsTable.lessonId)))

      for (const row of progressRows) {
        progressById.set(row.project_id, {
          completedTaskIds: row.completed_task_ids,
          updatedAt: row.updated_at,
        })
      }
    }

    // Most recent project per (student, lesson) — a retried/duplicated
    // lesson only counts once.
    const latestByStudentLesson = new Map<string, (typeof projectRows)[number]>()
    for (const p of projectRows) {
      const key = `${p.user_id}:${p.lesson_id}`
      if (!latestByStudentLesson.has(key)) latestByStudentLesson.set(key, p)
    }

    const activeUserIds = new Set<string>()
    for (const project of latestByStudentLesson.values()) {
      // The query filters on lesson_id IS NOT NULL, but the column is nullable
      // so the select type still admits null. Restated here rather than cast.
      if (project.lesson_id == null) continue
      const resolved = getLessonForProject(project.lesson_id, project.lesson_version)
      if (!resolved || resolved.tasks.length === 0) continue
      const progress = progressById.get(project.id)
      const doneIds = new Set(progress?.completedTaskIds ?? [])
      const done = resolved.tasks.filter((t) => doneIds.has(t.id)).length

      tasksCompleted += done
      if (done === resolved.tasks.length) lessonsCompleted++
      if (progress && progress.updatedAt >= weekAgo) {
        activeUserIds.add(project.user_id)
        const day = new Date(progress.updatedAt).toISOString().split('T')[0]
        activeByDay.get(day)?.add(project.user_id)
      }

      const weekTotal = weeklyTotals.get(resolved.id)
      if (weekTotal) weekTotal.done += done

      for (const [classId, ids] of classStudentIds) {
        if (ids.has(project.user_id))
          classTasksCompleted.set(classId, (classTasksCompleted.get(classId) ?? 0) + done)
      }
    }
    activeThisWeek = activeUserIds.size
  }

  const weeklyProgress = LESSONS.map((lesson) => {
    const totals = weeklyTotals.get(lesson.id)!
    return {
      lessonId: lesson.id,
      title: lesson.title,
      pct: totals.possible > 0 ? Math.round((totals.done / totals.possible) * 100) : 0,
      done: totals.done,
      possible: totals.possible,
    }
  })

  const activeTrend = dayKeys.map((day) => activeByDay.get(day)?.size ?? 0)

  const classRows = (classesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    students: classStudentIds.get(c.id)?.size ?? 0,
    tasksCompleted: classTasksCompleted.get(c.id) ?? 0,
  }))
  const maxClassTasks = Math.max(1, ...classRows.map((c) => c.tasksCompleted))

  return (
    <div className="space-y-6">
      <HeroMetric
        label="Active students this week"
        value={activeThisWeek.toLocaleString()}
        trend={activeTrend}
      />

      <Card>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2">
          <StatChip label="classes" value={classIds.length} />
          <StatChip label="students" value={studentIds.length} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Progress across your students
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {lessonsCompleted.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs mt-1">Lessons completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {tasksCompleted.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs mt-1">Tasks completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Weekly progress</h2>
          <div className="space-y-3.5">
            {weeklyProgress.map((w) => (
              <Meter
                key={w.lessonId}
                label={w.title}
                pct={w.pct}
                count={`${w.done}/${w.possible} tasks`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Classes</h2>
            <span className="text-xs text-muted-foreground/70">Tasks completed by class</span>
          </div>
          <div className="space-y-3.5">
            {classRows.map((c) => (
              <MagnitudeBar
                key={c.id}
                label={`${c.name} · ${c.students} ${c.students === 1 ? 'student' : 'students'}`}
                value={c.tasksCompleted}
                max={maxClassTasks}
                href={`/staff/classes/${c.id}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
