import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import { invalidate } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(req: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await hasPermission(user.id, 'students:manage'))) {
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

  await invalidate(`build-mode:${userId}`)

  return NextResponse.json({ ok: true })
}
