import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classes, orgInvites, organizations, roles, userRoles, users } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { aiRequestsByOrg } from '@/lib/ai-usage'

export interface ConsoleOrg {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  createdAt: string
  members: number
  classes: number
  aiRequests: number
  admins: { email: string; name: string }[]
  pendingInvites: { email: string; role: string; createdAt: string }[]
}

// Orgs with what the console shows about each, optionally narrowed to one.
// Cross-org on purpose: only the platform owner reaches this
// (app/console/layout.tsx).
async function load(only?: string): Promise<ConsoleOrg[]> {
  const [orgRows, memberRows, classRows, adminRows, inviteRows, aiRequests] = await Promise.all([
    db
      .select()
      .from(organizations)
      .where(only ? eq(organizations.id, only) : undefined)
      .orderBy(desc(organizations.createdAt)),
    db
      .select({ orgId: users.orgId, n: count() })
      .from(users)
      .where(only ? eq(users.orgId, only) : undefined)
      .groupBy(users.orgId),
    db
      .select({ orgId: classes.orgId, n: count() })
      .from(classes)
      .where(only ? eq(classes.orgId, only) : undefined)
      .groupBy(classes.orgId),
    db
      .select({ orgId: userRoles.orgId, email: users.email, name: users.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(roles.name, 'admin'), only ? eq(userRoles.orgId, only) : undefined)),
    db
      .select({
        orgId: orgInvites.orgId,
        email: orgInvites.email,
        role: orgInvites.role,
        createdAt: orgInvites.createdAt,
      })
      .from(orgInvites)
      .where(and(eq(orgInvites.status, 'pending'), only ? eq(orgInvites.orgId, only) : undefined)),
    aiRequestsByOrg(),
  ])

  const members = new Map(memberRows.map((r) => [r.orgId, Number(r.n)]))
  const classCounts = new Map(classRows.map((r) => [r.orgId, Number(r.n)]))
  return orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status as ConsoleOrg['status'],
    createdAt: org.createdAt,
    members: members.get(org.id) ?? 0,
    classes: classCounts.get(org.id) ?? 0,
    aiRequests: aiRequests.get(org.id) ?? 0,
    admins: adminRows.filter((a) => a.orgId === org.id).map(({ email, name }) => ({ email, name })),
    pendingInvites: inviteRows
      .filter((i) => i.orgId === org.id)
      .map(({ email, role, createdAt }) => ({ email, role, createdAt })),
  }))
}

export function loadOrgs(): Promise<ConsoleOrg[]> {
  return load()
}

// One org for /console/orgs/[id]; null for a malformed or unknown id.
export async function loadOrg(id: string): Promise<ConsoleOrg | null> {
  if (!isUuid(id)) return null
  const [org] = await load(id)
  return org ?? null
}
