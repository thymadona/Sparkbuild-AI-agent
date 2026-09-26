import StatCard from '@/components/dashboard/StatCard'
import { getSchoolOverviewStats } from './overview-stats'
import { AttentionFeed } from './OverviewWidgets'

// The org admin's overview. AI usage and cost are not here: only the platform
// owner sees them, in /console (lib/ai-usage.ts).
export default async function OverviewTab({ orgId }: { orgId: string }) {
  const {
    totalClasses,
    activeStudentCount,
    teacherCount,
    unpaidCount,
    overdueCount,
    lessonsStartedThisWeek,
  } = await getSchoolOverviewStats(orgId)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="classes" label="Classes" value={totalClasses} href="/staff/classes" />
        <StatCard
          icon="users"
          label="Active students"
          value={activeStudentCount}
          href="/staff/students"
        />
        <StatCard icon="teachers" label="Teachers" value={teacherCount} />
        <StatCard icon="lessons" label="Lessons started this week" value={lessonsStartedThisWeek} />
      </div>
      <AttentionFeed
        items={[
          {
            href: '/staff/finance',
            label: 'Unpaid invoices',
            count: unpaidCount,
            detail: overdueCount > 0 ? `${overdueCount} overdue` : undefined,
          },
        ]}
      />
    </div>
  )
}
