import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'

// Returns recent Telegram updates so admin can look up a parent's chat_id
// after the parent sends /start to the bot
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'telegram:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`)
  const data = await res.json() as { ok: boolean; result?: unknown[] }

  if (!data.ok) return NextResponse.json({ error: 'Telegram API error' }, { status: 500 })

  // Extract only chat_id + name from updates to keep response clean
  type TgUpdate = {
    message?: {
      from?: { first_name?: string; last_name?: string; username?: string }
      chat?: { id: number }
    }
  }
  const chats = (data.result as TgUpdate[] ?? [])
    .filter((u) => u.message?.chat?.id)
    .map((u) => ({
      chat_id: String(u.message!.chat!.id),
      name: [u.message!.from?.first_name, u.message!.from?.last_name].filter(Boolean).join(' '),
      username: u.message!.from?.username ?? null,
    }))

  // Deduplicate by chat_id
  const seen = new Set<string>()
  const unique = chats.filter((c) => {
    if (seen.has(c.chat_id)) return false
    seen.add(c.chat_id)
    return true
  })

  return NextResponse.json(unique)
}
