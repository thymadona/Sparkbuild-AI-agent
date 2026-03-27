import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  let query = supabaseAdmin.from('invoices').select('*').order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, amount_cents, description, due_date } =
    await req.json() as {
      user_id: string
      amount_cents: number
      description: string
      due_date: string
    }

  if (!user_id || !amount_cents || !description || !due_date) {
    return NextResponse.json({ error: 'user_id, amount_cents, description, due_date are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({ user_id, amount_cents, description, due_date })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
