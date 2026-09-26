import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classes,
  invoices,
  orgInvites,
  organizations,
  roles,
  userRoles,
  users,
} from '@/lib/db/schema'
import { invalidate } from '@/lib/cache'
import { grantOrgRole, type OrgRole } from '@/lib/org-people'
import { DIRECT_ORG_ID } from '@/lib/orgs'

export type InviteAnswer = { ok: true } | { ok: false; status: 404 | 409; error: string }

export const UNPAID_MESSAGE =
  'You have an unpaid SparkBuild invoice. Ask the SparkBuild team to settle or cancel it, then accept again.'
export const LAST_ADMIN_MESSAGE =
  'You are the last SparkBuild admin. Make someone else an admin first, then accept again.'

const NOT_FOUND: InviteAnswer = { ok: false, status: 404, error: 'Invite not found' }

// Thrown inside the transaction to roll it back with an answer for the user.
class Refused extends Error {
  constructor(readonly answer: InviteAnswer) {
    super(answer.ok ? 'ok' : answer.error)
  }
}

// A signed-in SparkBuild Direct user accepts a school's invite and moves into
// that org. The invite is bound to an email: it matches only the user's own
// address (read from users, lowercased), so another user's invite answers
// exactly like a missing one.
//
// One transaction, in this order:
//   1. refuse while the user has an unpaid Direct invoice (Direct's
//      receivable must not land in the school's finance);
//   2. refuse if it would remove Direct's last admin;
//   3. delete their non-student Direct grants — otherwise the ON UPDATE
//      CASCADE below would turn a Direct admin/teacher grant into a school
//      one. The org-less platform_admin grant (org_id NULL) is not matched;
//   4. move users.org_id: invoices, receipts and the student grant follow
//      through their composite FKs;
//   5. drop their Direct class memberships;
//   6. grant the invited role in the new org;
//   7. mark the invite accepted, and their other open invites declined —
//      a user belongs to one org.
// Projects, lesson progress and activity days are keyed by user id and do
// not change, so XP, badges and the streak come along.
export async function acceptInvite(userId: string, inviteId: string): Promise<InviteAnswer> {
  let answer: InviteAnswer
  try {
    answer = await db.transaction(async (tx) => {
      const [me] = await tx
        .select({ email: users.email, name: users.name, orgId: users.orgId })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')
      if (!me) throw new Refused(NOT_FOUND)
      const email = me.email.trim().toLowerCase()

      const [invite] = await tx
        .select({
          orgId: orgInvites.orgId,
          role: orgInvites.role,
          invitedBy: orgInvites.invitedBy,
          orgStatus: organizations.status,
        })
        .from(orgInvites)
        .innerJoin(organizations, eq(organizations.id, orgInvites.orgId))
        .where(
          and(
            eq(orgInvites.id, inviteId),
            eq(orgInvites.email, email),
            eq(orgInvites.status, 'pending')
          )
        )
        .for('update', { of: orgInvites })
      if (!invite) throw new Refused(NOT_FOUND)
      if (me.orgId !== DIRECT_ORG_ID)
        throw new Refused({ ok: false, status: 409, error: 'You already belong to a school' })
      if (invite.orgStatus !== 'active')
        throw new Refused({ ok: false, status: 409, error: 'That school is paused right now' })

      // 1. An unpaid Direct invoice.
      const [unpaid] = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.orgId, DIRECT_ORG_ID),
            eq(invoices.status, 'unpaid')
          )
        )
        .limit(1)
      if (unpaid) throw new Refused({ ok: false, status: 409, error: UNPAID_MESSAGE })

      // 2. Direct's last admin. Locking every Direct admin grant makes two
      // admins accepting at once queue here, so they can't both leave.
      const admins = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(userRoles.orgId, DIRECT_ORG_ID), eq(roles.name, 'admin')))
        .for('update', { of: userRoles })
      if (admins.some((a) => a.userId === userId) && admins.length === 1)
        throw new Refused({ ok: false, status: 409, error: LAST_ADMIN_MESSAGE })

      // 3. Non-student Direct grants.
      const studentRole = tx.select({ id: roles.id }).from(roles).where(eq(roles.name, 'student'))
      await tx
        .delete(userRoles)
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.orgId, DIRECT_ORG_ID),
            notInArray(userRoles.roleId, studentRole)
          )
        )

      // 4. The move.
      await tx.update(users).set({ orgId: invite.orgId }).where(eq(users.id, userId))

      // 5. Direct class memberships.
      await tx
        .delete(classMembers)
        .where(
          and(
            eq(classMembers.userId, userId),
            inArray(
              classMembers.classId,
              tx.select({ id: classes.id }).from(classes).where(eq(classes.orgId, DIRECT_ORG_ID))
            )
          )
        )

      // 6. The invited role.
      await grantOrgRole(tx, userId, invite.orgId, invite.role as OrgRole, invite.invitedBy, {
        name: me.name,
        parentEmail: null,
      })

      // 7. Answer this invite and the rest.
      await tx
        .update(orgInvites)
        .set({ status: 'accepted', respondedAt: sql`now()` })
        .where(eq(orgInvites.id, inviteId))
      await tx
        .update(orgInvites)
        .set({ status: 'declined', respondedAt: sql`now()` })
        .where(
          and(
            eq(orgInvites.email, email),
            eq(orgInvites.status, 'pending'),
            ne(orgInvites.id, inviteId)
          )
        )

      return { ok: true } as const
    })
  } catch (err) {
    if (err instanceof Refused) return err.answer
    throw err
  }

  // Role and lesson caches would otherwise answer for the old org for up to
  // their TTL. Permission keys (perm:<user>:<key>) are left to their 30s.
  await Promise.all(
    [`role:admin:${userId}`, `role:teacher:${userId}`, `enabled-lessons:${userId}`].map(invalidate)
  )
  return answer
}

// Declines one of the user's own open invites. Throws on a database error.
export async function declineInvite(userId: string, inviteId: string): Promise<InviteAnswer> {
  const rows = await db
    .update(orgInvites)
    .set({ status: 'declined', respondedAt: sql`now()` })
    .where(
      and(
        eq(orgInvites.id, inviteId),
        eq(orgInvites.status, 'pending'),
        eq(
          orgInvites.email,
          sql`(select lower(${users.email}) from ${users} where ${eq(users.id, userId)})`
        )
      )
    )
    .returning({ id: orgInvites.id })
  return rows.length ? { ok: true } : NOT_FOUND
}
