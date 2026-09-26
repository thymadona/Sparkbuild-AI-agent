import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites, roles, studentProfiles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'

export const ORG_ROLES = ['admin', 'teacher', 'student'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

// What an org admin may add from /staff. Naming an org admin stays in /console.
export const STAFF_ADDABLE_ROLES = ['student', 'teacher'] as const
export type StaffAddableRole = (typeof STAFF_ADDABLE_ROLES)[number]

export function isStaffAddableRole(role: unknown): role is StaffAddableRole {
  return (STAFF_ADDABLE_ROLES as readonly unknown[]).includes(role)
}

// The permission a staff member needs to add someone with this role: the same
// keys that guard /staff/students and granting roles in /staff/users.
export function permissionForRole(role: StaffAddableRole): 'students:manage' | 'roles:manage' {
  return role === 'student' ? 'students:manage' : 'roles:manage'
}

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
// A student's parentEmail goes on the profile only when that profile is made
// here; an existing profile is never overwritten, and an invite has nowhere
// to keep it.
//
// Runs inside the caller's transaction so the caller's other writes (a new
// org, a CSV batch row) stand or fall with it. The caller has already checked
// that it may write to orgId.
export async function addPersonToOrg(
  tx: Tx,
  input: {
    orgId: string
    email: string
    name: string
    role: OrgRole
    invitedBy: string
    parentEmail?: string | null
  }
): Promise<AddPersonResult> {
  const { orgId, email, name, role, invitedBy } = input
  const profile = { name, parentEmail: input.parentEmail ?? null }

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
    await grantOrgRole(tx, created.id, orgId, role, invitedBy, profile)
    return { kind: 'created', userId: created.id }
  }

  if (existing.orgId === orgId) {
    await grantOrgRole(tx, existing.id, orgId, role, invitedBy, profile)
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

// Grants an org role inside the caller's transaction, with the student
// profile a student gets at sign-in. Also used by the move flow
// (lib/org-move.ts) once the user is in the org.
export async function grantOrgRole(
  tx: Tx,
  userId: string,
  orgId: string,
  role: OrgRole,
  grantedBy: string | null,
  profile: { name: string; parentEmail: string | null }
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
      .values({
        userId,
        fullName: profile.name,
        parentEmail: profile.parentEmail,
        createdBy: grantedBy,
      })
      .onConflictDoNothing({ target: studentProfiles.userId })
  }

  await tx
    .insert(userRoles)
    .values({ userId, roleId, orgId, grantedBy })
    .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
}
