import { notFound, redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, messages, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getSessionUser } from '@/lib/auth/session'
import { emptyBoard, type BoardState } from '@/lib/board/reducer'
import { getLessonForProject } from '@/lib/lessons'
import { entryFileFor } from '@/lib/starter-file'
import { boardFromFiles } from '@/lib/board/code'
import { lessonFiles } from '@/lib/lesson-files'
import { getPlayerStats } from '@/lib/player-stats'
import { taskXp } from '@/lib/xp'
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
  if (lesson) {
    const [progress] = await db
      .select({ ids: lessonProgress.completedTaskIds })
      .from(lessonProgress)
      .where(eq(lessonProgress.projectId, id))
      .limit(1)
    completed = progress?.ids ?? []
  }

  // Course-wide XP minus this lesson's share; the client adds the live lesson XP back.
  const { xp } = await getPlayerStats(user.id)
  const baseXp = Math.max(
    0,
    xp - (lesson?.tasks ?? []).reduce((n, t) => n + (completed.includes(t.id) ? taskXp(t) : 0), 0)
  )

  return (
    <LiveBoard
      projectId={id}
      initialBoard={board}
      lastCaption={board.pages.length ? (last?.content ?? null) : null}
      lesson={lesson}
      entry={entry}
      files={files}
      completedTaskIds={completed}
      baseXp={baseXp}
    />
  )
}
