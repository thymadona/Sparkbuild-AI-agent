import Link from 'next/link'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classes, lessonProgress, projects as projectsTable } from '@/lib/db/schema'
import { getTeacherClassIds } from '@/lib/auth/permissions'
import { logMarks, marks, timed } from '@/lib/timing'
import { getLessonForProject, LESSONS } from '@/lib/lessons'
import type { SubmissionStatus } from '@/types'

const WEEK_MS = 7 * 86_400_000

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  )
}

// A ratio against a fixed limit (0–100%) reads as a meter, not a generic bar —
// same-ramp track + fill, one hue, value labeled at the tip.
function Meter({ label, pct, count }: { label: string; pct: number; count: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="shrink-0 text-xs text-gray-500">
          {count} · <span className="font-medium text-gray-300">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-gray-800">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Plain magnitude comparison across classes — no fixed ceiling, so the bar is
// scaled to the largest value in the set rather than to 100%.
function MagnitudeBar({ label, value, max, href }: { label: string; value: number; max: number; href: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0
  return (
    <Link href={href} className="block group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-200 group-hover:text-white transition-colors">{label}</span>
        <span className="shrink-0 text-xs font-medium text-gray-400">{value.toLocaleString()}</span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full bg-gray-800">
        <div className="h-full rounded-full bg-teal-500/80 group-hover:bg-teal-500 transition-colors" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  )
}

const STATUS_META: Record<SubmissionStatus, { label: string; className: string }> = {
  submitted: { label: 'Waiting for review', className: 'bg-amber-500' },
  approved: { label: 'Approved', className: 'bg-teal-500' },
  needs_work: { label: 'Sent back', className: 'bg-red-500' },
}

// Part-to-whole across a fixed status set — a segmented bar, colored by
// status (never a generic categorical hue) with a legend and its counts.
function StatusBar({ counts }: { counts: Record<SubmissionStatus, number> }) {
  const total = counts.submitted + counts.approved + counts.needs_work
  const order: SubmissionStatus[] = ['submitted', 'approved', 'needs_work']

  return (
    <div>
      {total === 0 ? (
        <div className="h-2.5 rounded-full bg-gray-800" />
      ) : (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {order.map((status) =>
            counts[status] > 0 ? (
              <div
                key={status}
                className={STATUS_META[status].className}
                style={{ width: `${(counts[status] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((status) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].className}`} />
            {STATUS_META[status].label}
            <span className="font-medium text-gray-300">{counts[status]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Scoped to classes this specific user teaches — getTeacherClassIds already
// filters by user_id, and every query below filters further by studentIds
// derived from those classes, so this never surfaces another teacher's roster.
export default async function TeacherOverviewTab({ userId }: { userId: string }) {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

  const m = marks()
  const started = Date.now()

  const classIds = await timed(m, 'teacher_class_ids', () => getTeacherClassIds(userId))

  if (classIds.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-500">
        You&apos;re not assigned to any classes yet.
      </div>
    )
  }

  const [classesData, studentMembers] = await Promise.all([
    timed(m, 'classes', () =>
      db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(inArray(classes.id, classIds))
    ),
    timed(m, 'class_members', () =>
      db
        .select({ user_id: classMembers.userId, class_id: classMembers.classId })
        .from(classMembers)
        .where(and(inArray(classMembers.classId, classIds), eq(classMembers.role, 'student')))
    ),
  ])

  const classStudentIds = new Map<string, Set<string>>()
  for (const id of classIds) classStudentIds.set(id, new Set())
  for (const m of studentMembers) classStudentIds.get(m.class_id)?.add(m.user_id)
  const studentIds = Array.from(new Set(studentMembers.map((m) => m.user_id)))

  const statusCounts: Record<SubmissionStatus, number> = { submitted: 0, approved: 0, needs_work: 0 }
  let lessonsCompleted = 0
  let tasksCompleted = 0
  let activeThisWeek = 0
  const weeklyTotals = new Map<number, { done: number; possible: number }>()
  for (const lesson of LESSONS) weeklyTotals.set(lesson.id, { done: 0, possible: studentIds.length * lesson.tasks.length })
  const classTasksCompleted = new Map<string, number>(classIds.map((id) => [id, 0]))

  if (studentIds.length > 0) {
    const [submissions, projectRows] = await Promise.all([
      timed(m, 'submissions', () =>
        db
          .select({
            user_id: projectsTable.userId,
            submission_status: projectsTable.submissionStatus,
          })
          .from(projectsTable)
          .where(
            and(
              isNotNull(projectsTable.submissionStatus),
              inArray(projectsTable.userId, studentIds)
            )
          )
      ),
      timed(m, 'projects', () =>
        db
        .select({
          id: projectsTable.id,
          user_id: projectsTable.userId,
          lesson_id: projectsTable.lessonId,
          lesson_version: projectsTable.lessonVersion,
          updated_at: projectsTable.updatedAt,
        })
        .from(projectsTable)
        .where(
          and(inArray(projectsTable.userId, studentIds), isNotNull(projectsTable.lessonId))
        )
          .orderBy(desc(projectsTable.updatedAt))
      ),
    ])

    for (const row of submissions) {
      const status = row.submission_status as SubmissionStatus
      if (status in statusCounts) statusCounts[status]++
    }

    const progressById = new Map<string, { completedTaskIds: string[]; updatedAt: string }>()
    if (projectRows.length > 0) {
      // Joined to projects rather than `inArray(projectId, projectRows.map(...))`.
      // That version bound one parameter per project row, and Postgres caps a
      // statement at 65535 bind parameters — a teacher with enough students
      // would not have been slow, they would have errored. The join re-uses the
      // same predicate as the projectRows query above, so the row set is
      // identical while only studentIds (bounded by roster size) is bound.
      const progressRows = await timed(m, 'lesson_progress', () =>
        db
        .select({
          project_id: lessonProgress.projectId,
          completed_task_ids: lessonProgress.completedTaskIds,
          updated_at: lessonProgress.updatedAt,
        })
        .from(lessonProgress)
        .innerJoin(projectsTable, eq(projectsTable.id, lessonProgress.projectId))
        .where(
          and(inArray(projectsTable.userId, studentIds), isNotNull(projectsTable.lessonId))
        )
      )

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
      if (progress && progress.updatedAt >= weekAgo) activeUserIds.add(project.user_id)

      const weekTotal = weeklyTotals.get(resolved.id)
      if (weekTotal) weekTotal.done += done

      for (const [classId, ids] of classStudentIds) {
        if (ids.has(project.user_id)) classTasksCompleted.set(classId, (classTasksCompleted.get(classId) ?? 0) + done)
      }
    }
    activeThisWeek = activeUserIds.size
  }

  logMarks('staff-teacher-overview', m, Date.now() - started)

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

  const classRows = (classesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    students: classStudentIds.get(c.id)?.size ?? 0,
    tasksCompleted: classTasksCompleted.get(c.id) ?? 0,
  }))
  const maxClassTasks = Math.max(1, ...classRows.map((c) => c.tasksCompleted))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Your classes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatTile label="Classes" value={classIds.length} />
          <StatTile label="Students" value={studentIds.length} />
          <StatTile label="Active this week" value={activeThisWeek} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">Homework</h2>
            <Link href="/staff/classes" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
              Review →
            </Link>
          </div>
          <StatusBar counts={statusCounts} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">Progress across your students</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-bold">{lessonsCompleted.toLocaleString()}</div>
              <div className="text-gray-500 text-xs mt-1">Lessons completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tasksCompleted.toLocaleString()}</div>
              <div className="text-gray-500 text-xs mt-1">Tasks completed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">Weekly progress</h2>
        <div className="space-y-3.5">
          {weeklyProgress.map((w) => (
            <Meter key={w.lessonId} label={w.title} pct={w.pct} count={`${w.done}/${w.possible} tasks`} />
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400">Classes</h2>
          <span className="text-xs text-gray-600">Tasks completed by class</span>
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
      </div>
    </div>
  )
}
