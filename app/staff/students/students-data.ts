import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classes as classesTable,
  invoices,
  roles,
  studentProfiles,
  userRoles,
  users as usersTable,
} from '@/lib/db/schema'
import { STAFF_ROLES } from '@/lib/auth/permissions'
import { usersInOrg } from '@/lib/orgs'
import type { Class } from '@/types'

// Everything /staff/students lists, for one org. Every query carries the org
// predicate: users, classes and invoices by org_id; profiles through their
// user; memberships through their class; staff grants by user_roles.org_id.
export async function loadStudents(orgId: string) {
  const [allUsers, profiles, members, classes, invoiceRows, staffRoleRows] = await Promise.all([
    // Reads public.users directly. The Supabase Auth admin listing this
    // replaced was paginated at 1000 and silently dropped everyone past it.
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        created_at: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.orgId, orgId)),
    db
      .select({
        user_id: studentProfiles.userId,
        full_name: studentProfiles.fullName,
        parent_email: studentProfiles.parentEmail,
        parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
        notes: studentProfiles.notes,
        is_active: studentProfiles.isActive,
      })
      .from(studentProfiles)
      .where(inArray(studentProfiles.userId, usersInOrg(orgId))),
    // Was PostgREST's embedded `classes(name)`, which came back nested one or
    // many depending on the relationship and needed a cast plus an
    // Array.isArray check to read. A join returns the name flat.
    db
      .select({ user_id: classMembers.userId, class_name: classesTable.name })
      .from(classMembers)
      .innerJoin(classesTable, eq(classesTable.id, classMembers.classId))
      .where(eq(classesTable.orgId, orgId)),
    db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        description: classesTable.description,
        created_at: classesTable.createdAt,
      })
      .from(classesTable)
      .where(eq(classesTable.orgId, orgId))
      .orderBy(asc(classesTable.name)),
    db
      .select({ user_id: invoices.userId, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.orgId, orgId)),
    db
      .select({ user_id: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.orgId, orgId), inArray(roles.name, [...STAFF_ROLES]))),
  ])

  // user_roles now holds a 'student' row for every non-staff account
  // (lib/auth/student-defaults.ts), so the query above filters to STAFF_ROLES
  // — without that filter this list would exclude every student and render
  // empty. An account can also hold a student_profiles row *and* a staff role
  // at once (e.g. a teacher's own test account), so exclude anyone with a
  // staff role rather than trusting the profile alone.
  const staffIds = new Set(staffRoleRows.map((r) => r.user_id))
  const users = allUsers.filter((u) => !staffIds.has(u.id))
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))

  const classMap: Record<string, string[]> = {}
  for (const m of members) {
    if (!classMap[m.user_id]) classMap[m.user_id] = []
    classMap[m.user_id].push(m.class_name)
  }

  const paymentMap: Record<string, { paid: number; unpaid: number }> = {}
  for (const inv of invoiceRows) {
    if (!paymentMap[inv.user_id]) paymentMap[inv.user_id] = { paid: 0, unpaid: 0 }
    if (inv.status === 'paid') paymentMap[inv.user_id].paid++
    else if (inv.status === 'unpaid') paymentMap[inv.user_id].unpaid++
  }

  const rows = users
    .map((u) => ({
      id: u.id,
      email: u.email || u.id,
      name: profileMap[u.id]?.full_name || u.name || '',
      isActive: profileMap[u.id]?.is_active ?? true,
      hasProfile: !!profileMap[u.id],
      parentEmail: profileMap[u.id]?.parent_email ?? '',
      parentTelegramChatId: profileMap[u.id]?.parent_telegram_chat_id ?? '',
      notes: profileMap[u.id]?.notes ?? '',
      classes: classMap[u.id] ?? [],
      payment: paymentMap[u.id] ?? null,
      // users.createdAt is a Date, not an ISO string: the Better Auth tables
      // keep Drizzle's default `mode: 'date'` because the library reads and
      // writes real Date objects, unlike the application tables.
      createdAt: u.created_at.toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { rows, classes: (classes ?? []) as Class[] }
}
