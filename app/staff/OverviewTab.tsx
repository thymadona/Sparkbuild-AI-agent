import Link from 'next/link'
import { getSchoolOverviewStats } from './overview-stats'

const INPUT_COST_PER_M = 0.15
const OUTPUT_COST_PER_M = 0.60
const AVG_INPUT_TOKENS = 2000
const AVG_OUTPUT_TOKENS = 3000

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
  const {
    totalClasses,
    activeStudentCount,
    teacherCount,
    needsReview,
    unpaidCount,
    overdueCount,
    lessonsStartedThisWeek,
    submittedThisWeek,
    promptsToday,
    totalPrompts,
  } = await getSchoolOverviewStats()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Roster</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatTile label="Classes" value={totalClasses} />
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
            <div className="text-2xl font-bold">{needsReview}</div>
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
          <StatTile label="Lessons Started" value={lessonsStartedThisWeek} />
          <StatTile label="Homework Submitted" value={submittedThisWeek} />
          <StatTile label="AI Requests (24h)" value={promptsToday} />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold">{estimateCost(totalPrompts)}</div>
        <div className="text-gray-500 text-sm mt-1">
          Estimated all-time AI cost · {totalPrompts.toLocaleString()} requests total
        </div>
      </div>
    </div>
  )
}
