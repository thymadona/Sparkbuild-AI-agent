import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
