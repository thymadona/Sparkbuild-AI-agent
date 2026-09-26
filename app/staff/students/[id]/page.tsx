import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
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
  prompts,
  receipts,
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Class } from '@/types'

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default async function StudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const userId = params.id

  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'students:manage'))) redirect('/staff')
  if (!isUuid(userId)) notFound()

  const [accountRow, profileRows, memberships, invoices, allClasses, promptCount, projectCount] =
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
      // Same for the embedded `receipts(id)`: a left join gives the receipt id
      // flat, and null when the invoice has not been paid.
      db
        .select({
          id: invoicesTable.id,
          amount_cents: invoicesTable.amountCents,
          description: invoicesTable.description,
          due_date: invoicesTable.dueDate,
          status: invoicesTable.status,
          receipt_id: receipts.id,
        })
        .from(invoicesTable)
        .leftJoin(receipts, eq(receipts.invoiceId, invoicesTable.id))
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
        prompts,
        and(eq(prompts.userId, userId), inArray(prompts.userId, usersInOrg(caller.orgId)))
      ),
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

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/staff/students" className="hover:text-foreground transition-colors">
          Students
        </Link>
        <span>/</span>
        <span className="text-foreground">{profile?.full_name ?? user.email}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {profile?.full_name || <span className="text-muted-foreground italic">No name</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            <DeactivateToggle userId={userId} initialActive={profile.is_active} />
            <EditStudentModal
              student={{
                userId,
                fullName: profile.full_name,
                parentEmail: profile.parent_email ?? '',
                parentTelegramChatId: profile.parent_telegram_chat_id ?? '',
                notes: profile.notes ?? '',
              }}
            />
            <CreateInvoiceModal
              userId={userId}
              studentName={profile.full_name || (user.email ?? '')}
            />
          </div>
        )}
      </div>

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
              <span className="text-muted-foreground">AI requests</span>
              <p className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
                {promptCount ?? 0}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Projects</span>
              <p className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
                {projectCount ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classes */}
      <div className="rounded-md border border-border">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Classes{' '}
            <span className="text-muted-foreground/70 font-normal normal-case ml-1">
              ({enrolledClasses.length})
            </span>
          </p>
          {profile && (
            <AddToClassModal
              userId={userId}
              studentName={profile.full_name || (user.email ?? '')}
              classes={availableClasses}
            />
          )}
        </div>
        {enrolledClasses.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground/70">Not enrolled in any class.</p>
        ) : (
          <div className="divide-y divide-border">
            {enrolledClasses.map((cls) => (
              <div key={cls.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/staff/classes/${cls.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {cls.name}
                  </Link>
                  {cls.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cls.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {cls.schedules.length > 0 ? (
                      cls.schedules.map((s, i) => (
                        <Badge key={i} variant="secondary">
                          {DAY[s.day_of_week]} {formatTime(s.start_time)} · {s.duration_min}min
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground/70">No schedule</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/staff/classes/${cls.id}`}
                  className="text-xs text-muted-foreground/70 hover:text-foreground shrink-0"
                >
                  Details →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finance summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-destructive/10 ring-destructive/20">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-destructive/80 mb-1">
              Outstanding
            </div>
            <div className="text-2xl font-bold text-destructive">{formatAmount(totalUnpaid)}</div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 ring-success/20">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-success/80 mb-1">
              Collected
            </div>
            <div className="text-2xl font-bold text-success">{formatAmount(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Invoices
            </div>
            <div className="text-2xl font-bold text-foreground">{(invoices ?? []).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices table */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invoices
          </p>
          {profile && (
            <CreateInvoiceModal
              userId={userId}
              studentName={profile.full_name || (user.email ?? '')}
            />
          )}
        </div>
        {(invoices ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground/70">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).map((inv) => {
                const receiptId = inv.receipt_id ?? undefined
                const isOverdue = inv.status === 'unpaid' && inv.due_date < today
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                      {inv.description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                      {formatAmount(inv.amount_cents)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {new Date(inv.due_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {isOverdue && <span className="ml-1 text-destructive">overdue</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          inv.status === 'paid'
                            ? 'success'
                            : inv.status === 'void'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/invoice/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                        >
                          Invoice
                        </a>
                        {receiptId && (
                          <a
                            href={`/receipt/${receiptId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                          >
                            Receipt
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
