import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates = await req.json() as Partial<{
    amount_cents: number
    description: string
    due_date: string
    status: string
  }>

  // Prevent editing paid invoices
  const { data: existing } = await supabaseAdmin
    .from('invoices').select('status').eq('id', params.id).single()
  if (existing?.status === 'paid') {
    return NextResponse.json({ error: 'Cannot edit a paid invoice' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('invoices').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabaseAdmin
    .from('invoices').select('status').eq('id', params.id).single()
  if (existing?.status === 'paid') {
    return NextResponse.json({ error: 'Cannot delete a paid invoice' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('invoices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
