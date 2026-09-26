'use client'

import DataTable from '@/components/dashboard/DataTable'
import { Badge } from '@/components/ui/badge'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export type EnrolledClass = {
  id: string
  name: string
  description: string
  schedules: { day_of_week: number; start_time: string; duration_min: number }[]
}

export default function StudentClassesTable({ classes }: { classes: EnrolledClass[] }) {
  return (
    <DataTable
      rows={classes}
      getRowId={(c) => c.id}
      rowHref={(c) => `/staff/classes/${c.id}`}
      noun="classes"
      emptyText="Not enrolled in any class."
      columns={[
        {
          id: 'name',
          header: 'Class',
          sortValue: (c) => c.name.toLowerCase(),
          cell: (c) => (
            <div>
              <div className="font-medium text-foreground">{c.name}</div>
              {c.description && (
                <div className="max-w-xs truncate text-xs text-muted-foreground">
                  {c.description}
                </div>
              )}
            </div>
          ),
        },
        {
          id: 'schedule',
          header: 'Schedule',
          cell: (c) =>
            c.schedules.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {c.schedules.map((s, i) => (
                  <Badge key={i} variant="secondary">
                    {DAY[s.day_of_week]} {formatTime(s.start_time)} · {s.duration_min}min
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70">No schedule</span>
            ),
        },
      ]}
    />
  )
}
