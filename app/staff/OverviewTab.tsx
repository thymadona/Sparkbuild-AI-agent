import Link from 'next/link'
import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { STAFF_ROLES } from '@/lib/auth/permissions'
import {
  classMembers,
  classes,
  invoices,
  projects,
  prompts,
  roles,
  studentProfiles,
  userRoles,
} from '@/lib/db/schema'

const INPUT_COST_PER_M = 0.15
const OUTPUT_COST_PER_M = 0.60
const AVG_INPUT_TOKENS = 2000
const AVG_OUTPUT_TOKENS = 3000
const WEEK_MS = 7 * 86_400_000

function estimateCost(count: number): string {
  const d = count * ((AVG_INPUT_TOKENS * INPUT_COST_PER_M + AVG_OUTPUT_TOKENS * OUTPUT_COST_PER_M) / 1_000_000)
  return d < 0.01 ? '<$0.01' : `$${d.toFixed(2)}`
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  )
}

export default async function OverviewTab() {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const today = new Date().toISOString().split('T')[0]

  // db.$count issues a real count(*). PostgREST counted with
  // `select('*', { count: 'exact', head: true })`, which still planned a full
  // select and threw every row away.
  const [
    totalClasses,
    activeStudentProfiles,
    teacherMembers,
    staffRoleRows,
    needsReview,
    unpaidInvoices,
    lessonsStartedThisWeek,
    submittedThisWeek,
    totalPrompts,
    promptsToday,
  ] = await Promise.all([
    db.$count(classes),
    db
      .select({ user_id: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.isActive, true)),
    db
      .select({ user_id: classMembers.userId })
      .from(classMembers)
      .where(eq(classMembers.role, 'teacher')),
    db
      .select({ user_id: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(inArray(roles.name, [...STAFF_ROLES])),
    db.$count(projects, eq(projects.submissionStatus, 'submitted')),
    db
      .select({ due_date: invoices.dueDate })
      .from(invoices)
      .where(eq(invoices.status, 'unpaid')),
    db.$count(projects, and(isNotNull(projects.lessonId), gte(projects.createdAt, weekAgo))),
    db.$count(
      projects,
      and(isNotNull(projects.submissionStatus), gte(projects.updatedAt, weekAgo))
    ),
    db.$count(prompts),
    db.$count(prompts, gte(prompts.createdAt, dayAgo)),
  ])

  const teacherIds = new Set(teacherMembers.map((m) => m.user_id))
  const teacherCount = teacherIds.size
  // user_roles now holds a 'student' row for every non-staff account
  // (lib/auth/student-defaults.ts), so "has a user_roles row" no longer means
  // "is staff" — the query above filters to STAFF_ROLES for that reason. A
  // profile can exist for someone who also holds a staff role (e.g. a teacher
  // or admin's own test account); don't count them as a student.
  const staffIds = new Set(staffRoleRows.map((r) => r.user_id))
  const activeStudentCount = activeStudentProfiles.filter((p) => !staffIds.has(p.user_id)).length
  const unpaidCount = unpaidInvoices.length
  const overdueCount = unpaidInvoices.filter((inv) => inv.due_date < today).length
  const safeTotalPrompts = totalPrompts

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Roster</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatTile label="Classes" value={totalClasses ?? 0} />
          <StatTile label="Active Students" value={activeStudentCount} />
          <StatTile label="Teachers" value={teacherCount} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Needs Attention</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/staff/homework"
            className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
          >
            <div className="text-2xl font-bold">{needsReview ?? 0}</div>
            <div className="text-gray-500 text-sm mt-1">Homework awaiting review</div>
          </Link>
          <Link
            href="/staff/finance"
            className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
          >
            <div className="text-2xl font-bold flex items-baseline gap-2">
              {unpaidCount}
              {overdueCount > 0 && (
                <span className="text-red-400 text-sm font-medium">{overdueCount} overdue</span>
              )}
            </div>
            <div className="text-gray-500 text-sm mt-1">Unpaid invoices</div>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">This Week</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatTile label="Lessons Started" value={lessonsStartedThisWeek ?? 0} />
          <StatTile label="Homework Submitted" value={submittedThisWeek ?? 0} />
          <StatTile label="AI Requests (24h)" value={promptsToday ?? 0} />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold">{estimateCost(safeTotalPrompts)}</div>
        <div className="text-gray-500 text-sm mt-1">
          Estimated all-time AI cost · {safeTotalPrompts.toLocaleString()} requests total
        </div>
      </div>
    </div>
  )
}
