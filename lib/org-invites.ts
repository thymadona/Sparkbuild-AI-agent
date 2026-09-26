import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites } from '@/lib/db/schema'

export interface PendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
}

// One org's open invites, newest first. Throws on a database error.
export async function loadPendingInvites(orgId: string): Promise<PendingInvite[]> {
  return db
    .select({
      id: orgInvites.id,
      email: orgInvites.email,
      role: orgInvites.role,
      createdAt: orgInvites.createdAt,
    })
    .from(orgInvites)
    .where(and(eq(orgInvites.orgId, orgId), eq(orgInvites.status, 'pending')))
    .orderBy(desc(orgInvites.createdAt))
}
