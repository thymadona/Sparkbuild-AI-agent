import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import ProfileClient from './ProfileClient'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { studentProfiles } from '@/lib/db/schema'

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/')

  // student_profiles.full_name is the source of truth for a human-facing
  // name — it is what every /staff surface reads and what an admin edits.
  // users.name is the value Google supplied at sign-in, used only as the
  // seed and as a fallback for staff accounts, which have no profile row.
  const [profile] = await db
    .select({ full_name: studentProfiles.fullName })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1)

  return <ProfileClient email={user.email} initialName={profile?.full_name || user.name} />
}
