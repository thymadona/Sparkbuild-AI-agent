import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: source } = await supabaseAdmin
    .from('projects')
    .select('title, files, is_public, user_id')
    .eq('id', id)
    .single()

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (source.user_id !== user.id && !source.is_public)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: copy, error } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: user.id,
      title: `Copy of ${source.title}`,
      files: source.files,
      is_public: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(copy)
}
