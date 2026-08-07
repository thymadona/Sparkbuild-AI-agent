import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission, isTeacherOfClass } from '@/lib/auth/permissions'
import { LESSONS } from '@/lib/lessons'

// Toggles a lesson week on/off for one class. isTeacherOfClass is already
// admin-inclusive (see 20260807130000_class_members_role.sql), so this one
// check covers both "admin managing any class" and "the teacher(s) of this
// specific class" — the same two callers who reach /staff/classes/[id].
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = (await hasPermission(user.id, 'classes:manage')) || (await isTeacherOfClass(user.id, params.id))
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { lessonId?: number; enabled?: boolean }
  const { lessonId, enabled } = body

  if (typeof lessonId !== 'number' || !LESSONS.some((l) => l.id === lessonId)) {
    return NextResponse.json({ error: 'lessonId must match a lesson in the catalog' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  if (enabled) {
    const { error } = await supabaseAdmin
      .from('class_enabled_lessons')
      .upsert({ class_id: params.id, lesson_id: lessonId, enabled_by: user.id }, { onConflict: 'class_id,lesson_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('class_enabled_lessons')
      .delete()
      .eq('class_id', params.id)
      .eq('lesson_id', lessonId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
