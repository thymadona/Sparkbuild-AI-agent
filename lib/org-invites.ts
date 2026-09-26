import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites, organizations, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'

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

export interface MyInvite {
  id: string
  orgName: string
  role: string
  createdAt: string
}

// The open invites a signed-in user may answer: only a SparkBuild Direct user
// gets any (a school user can't move), matched on their own address from
// users, lowercased, never on anything the client sends. A paused school's
// invite waits until it is active again. Throws on a database error.
export async function loadMyInvites(user: { id: string; orgId: string }): Promise<MyInvite[]> {
  if (user.orgId !== DIRECT_ORG_ID) return []
  return db
    .select({
      id: orgInvites.id,
      orgName: organizations.name,
      role: orgInvites.role,
      createdAt: orgInvites.createdAt,
    })
    .from(orgInvites)
    .innerJoin(organizations, eq(organizations.id, orgInvites.orgId))
    .where(
      and(
        eq(orgInvites.status, 'pending'),
        eq(organizations.status, 'active'),
        eq(
          orgInvites.email,
          sql`(select lower(${users.email}) from ${users} where ${eq(users.id, user.id)})`
        )
      )
    )
    .orderBy(desc(orgInvites.createdAt))
}
