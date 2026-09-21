import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth/permissions'
import TelegramClient from './TelegramClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function TelegramPage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'telegram:manage'))) redirect('/staff')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Telegram</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Look up parent chat IDs for invoice notifications
        </p>
      </div>
      <TelegramClient />
    </div>
  )
}
