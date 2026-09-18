'use client'

import type { SubmissionRow } from './page'
import HomeworkReviewTable from '@/components/dashboard/HomeworkReviewTable'

export default function HomeworkClient({ rows }: { rows: SubmissionRow[] }) {
  const waiting = rows.filter((row) => row.status === 'submitted')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {waiting.length === 0
          ? 'Nothing waiting for review.'
          : `${waiting.length} ${waiting.length === 1 ? 'submission' : 'submissions'} waiting for review.`}
      </p>
      <HomeworkReviewTable rows={rows} />
    </div>
  )
}
