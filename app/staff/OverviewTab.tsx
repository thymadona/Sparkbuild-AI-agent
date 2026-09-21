import { Card, CardContent } from '@/components/ui/card'
import { getSchoolOverviewStats } from './overview-stats'
import { AttentionFeed, HeroMetric, StatChip } from './OverviewWidgets'

const INPUT_COST_PER_M = 0.15
const OUTPUT_COST_PER_M = 0.6
const AVG_INPUT_TOKENS = 2000
const AVG_OUTPUT_TOKENS = 3000

function estimateCost(count: number): string {
  const d =
    count *
    ((AVG_INPUT_TOKENS * INPUT_COST_PER_M + AVG_OUTPUT_TOKENS * OUTPUT_COST_PER_M) / 1_000_000)
  return d < 0.01 ? '<$0.01' : `$${d.toFixed(2)}`
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
    promptsByDay,
  } = await getSchoolOverviewStats()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroMetric
            label="AI requests today"
            value={promptsToday.toLocaleString()}
            sub={`${totalPrompts.toLocaleString()} all-time · ~${estimateCost(totalPrompts)} estimated cost`}
            trend={promptsByDay}
          />
        </div>
        <AttentionFeed
          items={[
            { href: '/staff/homework', label: 'Homework awaiting review', count: needsReview },
            {
              href: '/staff/finance',
              label: 'Unpaid invoices',
              count: unpaidCount,
              detail: overdueCount > 0 ? `${overdueCount} overdue` : undefined,
            },
          ]}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2">
          <StatChip label="classes" value={totalClasses} />
          <StatChip label="active students" value={activeStudentCount} />
          <StatChip label="teachers" value={teacherCount} />
          <StatChip label="lessons started this week" value={lessonsStartedThisWeek} />
          <StatChip label="homework submitted this week" value={submittedThisWeek} />
        </CardContent>
      </Card>
    </div>
  )
}
