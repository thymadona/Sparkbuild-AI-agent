import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json() as { name: string; description?: string }
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({ name, description: description ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
