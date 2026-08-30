import { notFound, redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import LessonDetailClient from './LessonDetailClient'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LessonPage(props: Props) {
  const params = await props.params;
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  const lesson = LESSONS.find((l) => l.id === Number(params.id))
  if (!lesson) notFound()

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.lessonId, lesson.id)))
    .orderBy(desc(projects.updatedAt))
    .limit(1)

  return <LessonDetailClient lesson={lesson} existingProjectId={existing?.id ?? null} />
}
