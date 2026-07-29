import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ buildModeEnabled: false })
  }

  try {
    const { data } = await supabaseAdmin
      .from('user_build_mode')
      .select('enabled')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ buildModeEnabled: data?.enabled === true })
  } catch {
    return NextResponse.json({ buildModeEnabled: false })
  }
}
