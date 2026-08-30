import { redirect, notFound } from 'next/navigation'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classSchedules, lessonProgress as lessonProgressTable, messages as messagesTable, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import type { Project, Message } from '@/types'
import { getLessonForProject } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'
import EditorLayout from './EditorLayout'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage(props: Props) {
  const params = await props.params;
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  if (!isUuid(params.id)) notFound()

  // Both queries carry the ownership predicate, so a project belonging to
  // someone else yields nothing from either. Previously the messages query
  // was scoped by project id alone and relied on the result being discarded
  // after the check below.
  const [projectRows, messages] = await Promise.all([
    db
      .select({
        id: projects.id,
        user_id: projects.userId,
        title: projects.title,
        files: projects.files,
        is_public: projects.isPublic,
        lesson_id: projects.lessonId,
        lesson_version: projects.lessonVersion,
        submission_status: projects.submissionStatus,
        created_at: projects.createdAt,
        updated_at: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
      .limit(1),
    db
      .select({
        id: messagesTable.id,
        project_id: messagesTable.projectId,
        user_id: messagesTable.userId,
        role: messagesTable.role,
        content: messagesTable.content,
        created_at: messagesTable.createdAt,
      })
      .from(messagesTable)
      .innerJoin(projects, eq(projects.id, messagesTable.projectId))
      .where(and(eq(messagesTable.projectId, params.id), eq(projects.userId, user.id)))
      .orderBy(asc(messagesTable.createdAt))
      .limit(100),
  ])

  const project = projectRows[0]
  if (!project) {
    notFound()
  }

  const lesson = project.lesson_id != null
    ? getLessonForProject(project.lesson_id, project.lesson_version)
    : null

  // Homework is due before this student's next class. Slots are passed raw so
  // the browser can resolve them in the student's own timezone.
  let classSlots: ClassSlot[] = []
  let lessonProgress: { completed_task_ids: string[] } | null = null

  if (lesson) {
    const [progressRows, memberships] = await Promise.all([
      db
        .select({ completed_task_ids: lessonProgressTable.completedTaskIds })
        .from(lessonProgressTable)
        .where(eq(lessonProgressTable.projectId, params.id))
        .limit(1),
      db
        .select({ class_id: classMembers.classId })
        .from(classMembers)
        .where(eq(classMembers.userId, user.id)),
    ])
    lessonProgress = progressRows[0] ?? null

    const classIds = memberships.map((row) => row.class_id)
    if (classIds.length > 0) {
      classSlots = await db
        .select({
          day_of_week: classSchedules.dayOfWeek,
          start_time: classSchedules.startTime,
        })
        .from(classSchedules)
        .where(inArray(classSchedules.classId, classIds))
    }
  }

  return (
    <EditorLayout
      classSlots={classSlots}
      project={project as Project}
      initialMessages={messages as Message[]}
      lesson={lesson}
      initialCompletedTaskIds={lessonProgress?.completed_task_ids ?? []}
      userEmail={user.email ?? ''}
    />
  )
}
