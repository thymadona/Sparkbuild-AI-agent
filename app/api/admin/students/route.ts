import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, parent_email, parent_telegram_chat_id, notes } =
    await req.json() as {
      email: string
      full_name: string
      parent_email?: string
      parent_telegram_chat_id?: string
      notes?: string
    }

  if (!email || !full_name) {
    return NextResponse.json({ error: 'email and full_name are required' }, { status: 400 })
  }

  // Create the Supabase auth user (no password — magic link only)
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }

  const newUserId = created.user.id

  // Insert student profile
  const { error: profileErr } = await supabaseAdmin.from('student_profiles').insert({
    user_id: newUserId,
    full_name,
    parent_email: parent_email ?? null,
    parent_telegram_chat_id: parent_telegram_chat_id ?? null,
    notes: notes ?? null,
    created_by: user.id,
  })
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ userId: newUserId })
}
