import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
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
 * Middleware only guards page navigation under /admin, so this route checks
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

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, user_id, submission_status')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.submission_status == null) {
    return NextResponse.json({ error: 'This homework has not been handed in' }, { status: 409 })
  }

  if (!admin) {
    const classIds = await getTeacherClassIds(user.id)
    const { data: membership } = await supabaseAdmin
      .from('class_members')
      .select('class_id')
      .eq('user_id', project.user_id)
      .eq('role', 'student')
      .in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])

    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update({ submission_status: status, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (feedback) {
    const { error: msgError } = await supabaseAdmin.from('messages').insert({
      project_id: params.id,
      user_id: project.user_id,
      role: 'teacher',
      content: feedback,
    })
    if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  return NextResponse.json({ submissionStatus: status })
}
