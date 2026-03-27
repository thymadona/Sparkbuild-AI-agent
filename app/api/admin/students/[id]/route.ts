import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

// PATCH: update student profile fields (is_active, full_name, parent_email, parent_telegram_chat_id, notes)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
