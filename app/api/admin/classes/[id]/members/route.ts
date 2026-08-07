import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role } = await req.json() as { userId: string; role?: 'student' | 'teacher' }
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (role && role !== 'student' && role !== 'teacher') {
    return NextResponse.json({ error: 'role must be student or teacher' }, { status: 400 })
  }

  // Upsert rather than insert: re-adding an existing member (e.g. flipping
  // a teacher back to a student, or vice versa) updates the role in place
  // instead of erroring on the composite (class_id, user_id) primary key.
  const { error } = await supabaseAdmin
    .from('class_members')
    .upsert({ class_id: params.id, user_id: userId, role: role ?? 'student' }, { onConflict: 'class_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('class_members')
    .delete()
    .eq('class_id', params.id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
