import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites, roles, studentProfiles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'

export const ORG_ROLES = ['admin', 'teacher', 'student'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type AddPersonResult =
  | { kind: 'created'; userId: string }
  | { kind: 'granted'; userId: string }
  | { kind: 'invited'; inviteId: string }
  | { kind: 'conflict' }

// Trimmed and lowercased, or null if it does not look like an address.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
}

// Brings one person into an org with a role, by email. What happens depends
// on whether the email already has an account, and where:
//
//   * none: the account is pre-provisioned in the org, with no credential.
//     The person claims it by signing in with Google on that address
//     (trusted-provider linking, lib/auth/index.ts). No account exists yet,
//     so there is nobody whose consent is needed.
//   * in this org: the role is granted (roles are additive).
//   * in SparkBuild Direct: an invite is recorded. The account is NOT moved;
//     only its owner, signed in, can accept (D2a group 4).
//   * in another school: refused. Each user belongs to one org.
//
// Runs inside the caller's transaction so the caller's other writes (a new
// org, a CSV batch row) stand or fall with it. The caller has already checked
// that it may write to orgId.
export async function addPersonToOrg(
  tx: Tx,
  input: { orgId: string; email: string; name: string; role: OrgRole; invitedBy: string }
): Promise<AddPersonResult> {
  const { orgId, email, name, role, invitedBy } = input

  const [existing] = await tx
    .select({ id: users.id, orgId: users.orgId })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1)

  if (!existing) {
    const [created] = await tx
      .insert(users)
      .values({ name, email, emailVerified: true, orgId })
      .returning({ id: users.id })
    await grant(tx, created.id, orgId, role, invitedBy, name)
    return { kind: 'created', userId: created.id }
  }

  if (existing.orgId === orgId) {
    await grant(tx, existing.id, orgId, role, invitedBy, name)
    return { kind: 'granted', userId: existing.id }
  }

  if (existing.orgId !== DIRECT_ORG_ID) return { kind: 'conflict' }

  // Re-inviting updates the role of the one open invite rather than piling
  // up a second (org_invites_pending_key).
  const [open] = await tx
    .select({ id: orgInvites.id })
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.orgId, orgId),
        eq(orgInvites.email, email),
        eq(orgInvites.status, 'pending')
      )
    )
    .limit(1)
  if (open) {
    await tx.update(orgInvites).set({ role, invitedBy }).where(eq(orgInvites.id, open.id))
    return { kind: 'invited', inviteId: open.id }
  }
  const [invite] = await tx
    .insert(orgInvites)
    .values({ orgId, email, role, invitedBy })
    .returning({ id: orgInvites.id })
  return { kind: 'invited', inviteId: invite.id }
}

async function grant(
  tx: Tx,
  userId: string,
  orgId: string,
  role: OrgRole,
  grantedBy: string,
  name: string
) {
  // Through tx, not roleIdByName's db: outside production the pool holds a
  // single connection, which this transaction already has.
  const [row] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, role)).limit(1)
  const roleId = row?.id
  if (!roleId) throw new Error(`role "${role}" is missing — run bun run db:migrate`)

  // A student gets the profile the sign-in hook would give them, so they show
  // up in /staff/students before their first sign-in.
  if (role === 'student') {
    await tx
      .insert(studentProfiles)
      .values({ userId, fullName: name, createdBy: grantedBy })
      .onConflictDoNothing({ target: studentProfiles.userId })
  }

  await tx
    .insert(userRoles)
    .values({ userId, roleId, orgId, grantedBy })
    .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
}
