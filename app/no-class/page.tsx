import { redirect } from 'next/navigation'
import NoClassClient from './NoClassClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function NoClassPage() {
  const user = await getSessionUser()

  if (!user) redirect('/')

  return <NoClassClient email={user.email ?? ''} />
}
