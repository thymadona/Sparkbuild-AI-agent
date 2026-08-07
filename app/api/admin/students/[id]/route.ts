import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'

// PATCH: update student profile fields (is_active, full_name, parent_email, parent_telegram_chat_id, notes)
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'students:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates = await req.json() as Partial<{
    is_active: boolean
    full_name: string
    parent_email: string
    parent_telegram_chat_id: string
    notes: string
  }>

  const { error } = await supabaseAdmin
    .from('student_profiles')
    .update(updates)
    .eq('user_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
