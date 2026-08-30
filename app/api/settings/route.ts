import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getSessionUser()

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
