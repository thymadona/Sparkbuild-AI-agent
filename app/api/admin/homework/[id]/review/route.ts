import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, messages, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission, isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'
import type { SubmissionStatus } from '@/types'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

const REVIEWABLE: SubmissionStatus[] = ['approved', 'needs_work']

/**
 * Teacher review of a homework submission.
 *
 * The route guard (proxy.ts) only guards page navigation under /admin, so this route checks
 * authorization itself. homework:review is granted to the teacher role,
 * but teachers are scoped to their own classes' students — a bare
 * permission check isn't enough, so non-admin callers get an extra
 * class-ownership check below (after the project is fetched).
 */
export async function POST(req: Request, props: Props) {
  const params = await props.params;
  const user = await getSessionUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isAdmin(user.id)
  if (!admin && !(await hasPermission(user.id, 'homework:review'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { status?: SubmissionStatus; feedback?: string }
  const status = body.status
  const feedback = (body.feedback ?? '').trim()

  if (!status || !REVIEWABLE.includes(status)) {
    return NextResponse.json({ error: 'status must be approved or needs_work' }, { status: 400 })
  }
  // Sending a student back to their code without saying why is not feedback.
  if (status === 'needs_work' && !feedback) {
    return NextResponse.json({ error: 'Feedback is required when asking for more work' }, { status: 400 })
  }

  if (!isUuid(params.id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const [project] = await db
    .select({
      id: projects.id,
      user_id: projects.userId,
      submission_status: projects.submissionStatus,
    })
    .from(projects)
    .where(eq(projects.id, params.id))
    .limit(1)

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.submission_status == null) {
    return NextResponse.json({ error: 'This homework has not been handed in' }, { status: 409 })
  }

  if (!admin) {
    const classIds = await getTeacherClassIds(user.id)
    // A teacher of no classes can review nobody. Short-circuiting also keeps
    // an empty list out of inArray, which would otherwise have to be spelled
    // as a sentinel uuid the way the PostgREST version did.
    if (classIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const membership = await db
      .select({ class_id: classMembers.classId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.userId, project.user_id),
          eq(classMembers.role, 'student'),
          inArray(classMembers.classId, classIds)
        )
      )
      .limit(1)

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // The status change and its feedback message are one unit: a `needs_work`
  // recorded without the message explaining it sends the student back to their
  // code with no reason given, which the validation above exists to prevent.
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ submissionStatus: status, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, params.id))

      if (feedback) {
        await tx.insert(messages).values({
          projectId: params.id,
          userId: project.user_id,
          role: 'teacher',
          content: feedback,
        })
      }
    })
  } catch (err) {
    console.error('POST /api/admin/homework/[id]/review failed:', err)
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 })
  }

  return NextResponse.json({ submissionStatus: status })
}
