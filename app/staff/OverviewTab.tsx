import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-server'

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

  const [
    { count: totalClasses },
    { data: activeStudentProfiles },
    { data: teacherMembers },
    { data: staffRoleRows },
    { count: needsReview },
    { data: unpaidInvoices },
    { count: lessonsStartedThisWeek },
    { count: submittedThisWeek },
    { count: totalPrompts },
    { count: promptsToday },
  ] = await Promise.all([
    supabaseAdmin.from('classes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('student_profiles').select('user_id').eq('is_active', true),
    supabaseAdmin.from('class_members').select('user_id').eq('role', 'teacher'),
    supabaseAdmin.from('user_roles').select('user_id'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('submission_status', 'submitted'),
    supabaseAdmin.from('invoices').select('due_date').eq('status', 'unpaid'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).not('lesson_id', 'is', null).gte('created_at', weekAgo),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).not('submission_status', 'is', null).gte('updated_at', weekAgo),
    supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
  ])

  const teacherIds = new Set((teacherMembers ?? []).map((m) => m.user_id))
  const teacherCount = teacherIds.size
  // Only 'admin' and 'teacher' roles exist in user_roles — a student never
  // has a row there. A profile can exist for someone who also holds a
  // staff role (e.g. a teacher or admin's own test account) — don't count
  // them as a student.
  const staffIds = new Set((staffRoleRows ?? []).map((r) => r.user_id))
  const activeStudentCount = (activeStudentProfiles ?? []).filter((p) => !staffIds.has(p.user_id)).length
  const unpaidCount = unpaidInvoices?.length ?? 0
  const overdueCount = (unpaidInvoices ?? []).filter((inv) => inv.due_date < today).length
  const safeTotalPrompts = totalPrompts ?? 0

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
