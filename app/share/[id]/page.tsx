import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import type { Project } from '@/types'
import Preview from '@/components/Preview'
import ForkButton from './ForkButton'
import { buildCombinedHtml } from '@/lib/combine'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SharePage(props: Props) {
  const params = await props.params;
  if (!isUuid(params.id)) notFound()

  // is_public is part of the predicate, not a check on the fetched row — a
  // private project yields nothing rather than being loaded and then rejected.
  const [project] = await db
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
    .where(and(eq(projects.id, params.id), eq(projects.isPublic, true)))
    .limit(1)

  if (!project) {
    notFound()
  }

  const typedProject = project as Project
  const code = buildCombinedHtml(typedProject.files)

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{typedProject.title}</span>
          <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">
            Public
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ForkButton projectId={typedProject.id} />
          <a
            href="/"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Build your own →
          </a>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <Preview code={code} />
      </div>
    </div>
  )
}
