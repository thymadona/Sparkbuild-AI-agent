import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/auth/session'

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabaseAdmin
    .from('projects').select('user_id').eq('id', params.id).single()
  if (!project || project.user_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('messages').select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({ messages: messages ?? [] })
}
