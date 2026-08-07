import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import TelegramClient from './TelegramClient'

export default async function TelegramPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await hasPermission(user.id, 'telegram:manage'))) redirect('/staff')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Telegram</h1>
        <p className="text-sm text-gray-500 mt-0.5">Look up parent chat IDs for invoice notifications</p>
      </div>
      <TelegramClient />
    </div>
  )
}
