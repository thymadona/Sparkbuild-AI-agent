import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

// GET /api/projects — list all projects for the authenticated user
export async function GET() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(projects)
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const title = body.title || 'Untitled'

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: user.id,
      title,
      files: {},
      is_public: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(project, { status: 201 })
}

// PATCH /api/projects — update title or is_public for a project
export async function PATCH(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, title, is_public } = body

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  // Verify ownership before update
  const { data: existing } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (is_public !== undefined) updates.is_public = is_public

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(project)
}

// DELETE /api/projects — delete a project
export async function DELETE(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  // Verify ownership before delete
  const { data: existing } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
