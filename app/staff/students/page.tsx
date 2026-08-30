import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classes as classesTable,
  invoices,
  studentProfiles,
  userRoles,
  users as usersTable,
} from '@/lib/db/schema'
import { hasPermission } from '@/lib/auth/permissions'
import StudentsClient from './StudentsClient'
import type { Class } from '@/types'
import { getSessionUser } from '@/lib/auth/session'

export default async function StudentsPage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'students:manage'))) redirect('/staff')

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
      .from(usersTable),
    db
      .select({
        user_id: studentProfiles.userId,
        full_name: studentProfiles.fullName,
        parent_email: studentProfiles.parentEmail,
        parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
        notes: studentProfiles.notes,
        is_active: studentProfiles.isActive,
      })
      .from(studentProfiles),
    // Was PostgREST's embedded `classes(name)`, which came back nested one or
    // many depending on the relationship and needed a cast plus an
    // Array.isArray check to read. A join returns the name flat.
    db
      .select({ user_id: classMembers.userId, class_name: classesTable.name })
      .from(classMembers)
      .innerJoin(classesTable, eq(classesTable.id, classMembers.classId)),
    db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        description: classesTable.description,
        created_at: classesTable.createdAt,
      })
      .from(classesTable)
      .orderBy(asc(classesTable.name)),
    db.select({ user_id: invoices.userId, status: invoices.status }).from(invoices),
    db.select({ user_id: userRoles.userId }).from(userRoles),
  ])

  // Only 'admin' and 'teacher' roles exist in user_roles — a student never
  // has a row there. An account can hold a student_profiles row *and* a
  // staff role at once (e.g. a teacher's own test account), so exclude
  // anyone with a platform role instead of trusting the profile alone.
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

  const rows = users.map((u) => ({
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
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage accounts, classes, and invoices</p>
      </div>
      <StudentsClient rows={rows} classes={(classes ?? []) as Class[]} />
    </div>
  )
}
