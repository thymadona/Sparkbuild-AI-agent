import { notFound, redirect } from 'next/navigation'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth/session'
import { usersInOrg } from '@/lib/orgs'
import { db } from '@/lib/db/client'
import {
  accounts,
  classMembers,
  classSchedules,
  classes as classesTable,
  invoices as invoicesTable,
  projects,
  sessions,
  studentProfiles,
  users as usersTable,
} from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import DeactivateToggle from '@/components/admin/DeactivateToggle'
import EditStudentModal from '@/components/admin/EditStudentModal'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import AddToClassModal from '@/components/admin/AddToClassModal'
import PageHeader from '@/components/dashboard/PageHeader'
import StatCard from '@/components/dashboard/StatCard'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { formatAmount } from '@/lib/format'
import type { Class } from '@/types'
import InvoicesTable, { type InvoiceListRow } from '../../finance/InvoicesTable'
import StudentClassesTable from './StudentClassesTable'

export default async function StudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const userId = params.id

  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'students:manage'))) redirect('/staff')
  if (!isUuid(userId)) notFound()

  const [accountRow, profileRows, memberships, invoices, allClasses, projectCount] =
    await Promise.all([
      // Replaces the Supabase Auth admin user lookup. Sign-in provider comes from
      // the linked OAuth account, and "last signed in" from the newest session
      // row (Better Auth has no last_sign_in_at column of its own) — both
      // backed by the sessions_user_id_idx / accounts_user_id_idx indexes.
      db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          created_at: usersTable.createdAt,
          provider_id: accounts.providerId,
        })
        .from(usersTable)
        .leftJoin(accounts, eq(accounts.userId, usersTable.id))
        .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, caller.orgId)))
        .limit(1),
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
        .where(
          and(
            eq(studentProfiles.userId, userId),
            inArray(studentProfiles.userId, usersInOrg(caller.orgId))
          )
        )
        .limit(1),
      // Was PostgREST's embedded `classes(...)`, which nested the joined row and
      // needed a cast plus an Array.isArray check at every read site.
      db
        .select({
          class_id: classMembers.classId,
          name: classesTable.name,
          description: classesTable.description,
        })
        .from(classMembers)
        .innerJoin(classesTable, eq(classesTable.id, classMembers.classId))
        .where(and(eq(classMembers.userId, userId), eq(classesTable.orgId, caller.orgId))),
      db
        .select({
          id: invoicesTable.id,
          amount_cents: invoicesTable.amountCents,
          description: invoicesTable.description,
          due_date: invoicesTable.dueDate,
          status: invoicesTable.status,
          sent_at: invoicesTable.sentAt,
        })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.orgId, caller.orgId)))
        .orderBy(desc(invoicesTable.createdAt)),
      db
        .select({
          id: classesTable.id,
          name: classesTable.name,
          description: classesTable.description,
          created_at: classesTable.createdAt,
        })
        .from(classesTable)
        .where(eq(classesTable.orgId, caller.orgId))
        .orderBy(asc(classesTable.name)),
      db.$count(
        projects,
        and(eq(projects.userId, userId), inArray(projects.userId, usersInOrg(caller.orgId)))
      ),
    ])

  // Every query above carries the caller's org, so another org's student is a
  // 404 here and nothing of theirs was read.
  const user = accountRow[0]
  if (!user) notFound()

  const profile = profileRows[0] ?? null

  // Newest session stands in for the old auth.users.last_sign_in_at.
  const [lastSession] = await db
    .select({ created_at: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(1)

  // Fetch schedules for enrolled classes
  const classIds = memberships.map((m) => m.class_id)

  const schedules =
    classIds.length > 0
      ? await db
          .select({
            class_id: classSchedules.classId,
            day_of_week: classSchedules.dayOfWeek,
            start_time: classSchedules.startTime,
            duration_min: classSchedules.durationMin,
          })
          .from(classSchedules)
          .where(inArray(classSchedules.classId, classIds))
          .orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime))
      : []

  const schedulesByClass: Record<
    string,
    { day_of_week: number; start_time: string; duration_min: number }[]
  > = {}
  for (const s of schedules) {
    if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
    schedulesByClass[s.class_id].push(s)
  }

  const enrolledClasses = memberships.map((m) => ({
    id: m.class_id,
    name: m.name,
    description: m.description ?? '',
    schedules: schedulesByClass[m.class_id] ?? [],
  }))

  const enrolledIds = new Set(enrolledClasses.map((c) => c.id))
  const availableClasses = allClasses.filter((c) => !enrolledIds.has(c.id)) as Class[]

  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amount_cents, 0)
  const totalUnpaid = invoices
    .filter((i) => i.status === 'unpaid')
    .reduce((s, i) => s + i.amount_cents, 0)

  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const lastSign = lastSession
    ? new Date(lastSession.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Never'

  const studentName = profile?.full_name || (user.email ?? '')

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/staff/students"
        title={profile?.full_name || <span className="italic text-muted-foreground">No name</span>}
        description={user.email}
        badge={profile && <StatusBadge status={profile.is_active ? 'active' : 'inactive'} />}
        actions={
          profile && (
            <>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                Active
                <DeactivateToggle userId={userId} initialActive={profile.is_active} />
              </span>
              <EditStudentModal
                student={{
                  userId,
                  fullName: profile.full_name,
                  parentEmail: profile.parent_email ?? '',
                  parentTelegramChatId: profile.parent_telegram_chat_id ?? '',
                  notes: profile.notes ?? '',
                }}
              />
            </>
          )
        }
      />

      {/* Profile info */}
      <Card>
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Profile
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Parent email</span>
              <p className="text-foreground mt-0.5">
                {profile?.parent_email || <span className="text-muted-foreground/70">—</span>}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Telegram chat ID</span>
              <p className="text-foreground mt-0.5 font-mono text-xs">
                {profile?.parent_telegram_chat_id || (
                  <span className="text-muted-foreground/70">—</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Joined</span>
              <p className="text-foreground mt-0.5">{joinedDate}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last sign in</span>
              <p className="text-foreground mt-0.5">{lastSign}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="mt-0.5">
                {profile ? (
                  <span
                    className={`text-xs font-medium ${profile.is_active ? 'text-success' : 'text-destructive'}`}
                  >
                    {profile.is_active ? 'Active' : 'Deactivated'}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 text-xs">No profile</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Auth provider</span>
              <p className="text-foreground mt-0.5 capitalize">
                {user.provider_id ?? 'not linked'}
              </p>
            </div>
          </div>
          {profile?.notes && (
            <div className="mt-4">
              <span className="text-muted-foreground text-sm">Notes</span>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap rounded bg-muted px-3 py-2">
                {profile.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Activity
          </p>
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-muted-foreground">Projects</span>
              <p className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
                {projectCount ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Classes ({enrolledClasses.length})
          </h2>
          {profile && (
            <AddToClassModal userId={userId} studentName={studentName} classes={availableClasses} />
          )}
        </div>
        <StudentClassesTable classes={enrolledClasses} />
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon="outstanding"
          tone="destructive"
          label="Outstanding"
          value={formatAmount(totalUnpaid)}
        />
        <StatCard
          icon="collected"
          tone="success"
          label="Collected"
          value={formatAmount(totalPaid)}
        />
        <StatCard icon="invoices" label="Invoices" value={invoices.length} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
          {profile && <CreateInvoiceModal userId={userId} studentName={studentName} />}
        </div>
        <InvoicesTable
          showStudent={false}
          invoices={invoices.map((inv) => ({
            id: inv.id,
            studentName,
            amount_cents: inv.amount_cents,
            description: inv.description,
            due_date: inv.due_date,
            status: inv.status as InvoiceListRow['status'],
            sent_at: inv.sent_at,
          }))}
        />
      </section>
    </div>
  )
}
