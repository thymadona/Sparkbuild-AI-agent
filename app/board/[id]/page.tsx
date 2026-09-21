import { notFound, redirect } from 'next/navigation'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classSchedules, lessonProgress, messages, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getSessionUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { emptyBoard, type BoardState } from '@/lib/board/reducer'
import { getLessonForProject } from '@/lib/lessons'
import { entryFileFor } from '@/lib/starter-file'
import { boardFromFiles } from '@/lib/board/code'
import { lessonFiles } from '@/lib/lesson-files'
import type { ClassSlot } from '@/lib/schedule'
import type { SubmissionStatus } from '@/types'
import LiveBoard from '../LiveBoard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LiveBoardPage({ params }: Props) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) redirect('/')
  if (!isUuid(id)) notFound()

  const [project] = await db
    .select({
      board: projects.board,
      files: projects.files,
      lessonId: projects.lessonId,
      lessonVersion: projects.lessonVersion,
      submission: projects.submissionStatus,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1)
  if (!project) notFound()

  const [last] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.projectId, id), eq(messages.role, 'assistant')))
    .orderBy(desc(messages.createdAt))
    .limit(1)

  const lesson =
    project.lessonId != null ? getLessonForProject(project.lessonId, project.lessonVersion) : null
  const files = (project.files ?? {}) as Record<string, string>
  const entry = entryFileFor(lesson, files)

  let board = project.board as BoardState | null
  // Work done before the board existed: keep it, if it differs from the untouched starter.
  if (!board && lesson && files[entry]) {
    if (files[entry] !== lessonFiles(lesson)[entry]) board = boardFromFiles(files[entry])
  }
  board ??= emptyBoard()

  let completed: string[] = []
  let classSlots: ClassSlot[] = []
  if (lesson) {
    const [[progress], memberships] = await Promise.all([
      db
        .select({ ids: lessonProgress.completedTaskIds })
        .from(lessonProgress)
        .where(eq(lessonProgress.projectId, id))
        .limit(1),
      db
        .select({ classId: classMembers.classId })
        .from(classMembers)
        .where(eq(classMembers.userId, user.id)),
    ])
    completed = progress?.ids ?? []
    if (memberships.length)
      classSlots = await db
        .select({ day_of_week: classSchedules.dayOfWeek, start_time: classSchedules.startTime })
        .from(classSchedules)
        .where(
          inArray(
            classSchedules.classId,
            memberships.map((m) => m.classId)
          )
        )
  }

  return (
    <LiveBoard
      projectId={id}
      initialBoard={board}
      lastCaption={board.pages.length ? (last?.content ?? null) : null}
      lesson={lesson}
      entry={entry}
      files={files}
      completedTaskIds={completed}
      submission={project.submission as SubmissionStatus | null}
      classSlots={classSlots}
      isAdmin={await isAdmin(user.id)}
    />
  )
}
