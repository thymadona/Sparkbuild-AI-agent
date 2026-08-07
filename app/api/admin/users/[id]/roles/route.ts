import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'

interface Props {
  params: Promise<{ id: string }>
}

const ASSIGNABLE_ROLES = ['admin', 'teacher']

export async function POST(req: Request, props: Props) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { role } = (await req.json().catch(() => ({}))) as { role?: string }
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role must be admin or teacher' }, { status: 400 })
  }

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', role)
    .single()
  if (roleErr || !roleRow) return NextResponse.json({ error: 'Unknown role' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: params.id, role_id: roleRow.id, granted_by: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, props: Props) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role must be admin or teacher' }, { status: 400 })
  }
  // Lockout safeguard: an admin can't revoke their own admin role.
  if (role === 'admin' && params.id === user.id) {
    return NextResponse.json({ error: 'Cannot revoke your own admin role' }, { status: 400 })
  }

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', role)
    .single()
  if (roleErr || !roleRow) return NextResponse.json({ error: 'Unknown role' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', params.id)
    .eq('role_id', roleRow.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
