import { count, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites, organizations, roles, userRoles, users } from '@/lib/db/schema'

export interface ConsoleOrg {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  members: number
  admins: { email: string; name: string }[]
  pendingInvites: { email: string; role: string }[]
}

// Every org with what the console shows about it. Cross-org on purpose: only
// the platform owner reaches this (app/console/layout.tsx).
export async function loadOrgs(): Promise<ConsoleOrg[]> {
  const [orgRows, memberRows, adminRows, inviteRows] = await Promise.all([
    db.select().from(organizations).orderBy(desc(organizations.createdAt)),
    db.select({ orgId: users.orgId, n: count() }).from(users).groupBy(users.orgId),
    db
      .select({ orgId: userRoles.orgId, email: users.email, name: users.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(roles.name, 'admin')),
    db
      .select({ orgId: orgInvites.orgId, email: orgInvites.email, role: orgInvites.role })
      .from(orgInvites)
      .where(eq(orgInvites.status, 'pending')),
  ])

  const members = new Map(memberRows.map((r) => [r.orgId, Number(r.n)]))
  return orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status as ConsoleOrg['status'],
    members: members.get(org.id) ?? 0,
    admins: adminRows.filter((a) => a.orgId === org.id).map(({ email, name }) => ({ email, name })),
    pendingInvites: inviteRows
      .filter((i) => i.orgId === org.id)
      .map(({ email, role }) => ({ email, role })),
  }))
}
