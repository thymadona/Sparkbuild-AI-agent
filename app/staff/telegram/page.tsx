import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth/permissions'
import TelegramClient from './TelegramClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function TelegramPage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'telegram:manage'))) redirect('/staff')

  return <TelegramClient />
}
