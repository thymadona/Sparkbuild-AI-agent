import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import BoardClient from './BoardClient'

// Phase 1: a scripted demo, no project or database yet.
export default async function BoardPage() {
  if (!(await getSessionUser())) redirect('/')
  return <BoardClient />
}
