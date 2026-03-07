import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, buildModeEnabled } = await req.json() as { userId: string; buildModeEnabled: boolean }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_build_mode')
    .upsert({ user_id: userId, enabled: buildModeEnabled, updated_at: new Date().toISOString() })

  if (error) {
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
